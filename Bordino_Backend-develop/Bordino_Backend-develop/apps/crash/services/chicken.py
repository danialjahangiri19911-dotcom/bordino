"""Chicken (Galaxsys "Chicken Crash" style): cross lanes, cash out before a car hits.

Provably fair, decided entirely at bet time:

    u_i      = first 4 bytes of HMAC_SHA256(server_seed, f"{client_seed}:{nonce}:{i}") / 2^32
    hit_lane = first lane i (1-based) with u_i < hit, or none
    m_i      = floor((1 - edge) / (1 - hit)^i, 2 decimals)

so cashing out after any lane returns (1 - edge) on average.  The road has no fixed end: it runs
to the last lane whose win still fits under max_payout (crossing it cashes out by itself), so every
lane pays its full multiplier; at most MAX_LANES.  Money handling mirrors
services/rounds.py: server-picked points account, row locks, F() balance updates, one settlement.
"""

import hashlib
import hmac
from decimal import Decimal

from django.db import transaction
from django.db.models import F
from django.utils import timezone

from apps.crash.models import CHICKEN_DIFFICULTIES, ChickenConfiguration, ChickenRound
from apps.crash.services import fair
from apps.crash.services.rounds import (
    CrashError,
    RoundNotFound,
    StaleRound,
    customer_for,
    points_account,
    seed_for,
)
from apps.wallet.models import TokenWalletAccount

_TWO_32 = 2**32
# The longest road (only reached when the payout cap is far away, e.g. a tiny bet on easy).
MAX_LANES = 300
# A lane multiplier past this would not fit ChickenRound.cashout_multiplier (12 digits, 2 decimals).
MAX_MULTIPLIER = Decimal("1000000000")


def lane_multipliers(lanes: int, hit: Decimal, house_edge: Decimal) -> list[Decimal]:
    """Multiplier after surviving lane 1..lanes (index 0 = lane 1)."""
    survive = Decimal(1) - Decimal(hit)
    keep = Decimal(1) - Decimal(house_edge)
    return [fair.floor_cents(keep / survive**lane) for lane in range(1, lanes + 1)]


def hit_lane(server_seed: str, client_seed: str, nonce: int, lanes: int, hit: Decimal):
    threshold = Decimal(hit) * _TWO_32
    for lane in range(1, lanes + 1):
        message = f"{client_seed}:{nonce}:{lane}".encode()
        digest = hmac.new(server_seed.encode(), message, hashlib.sha256).digest()
        if int.from_bytes(digest[:4], "big") < threshold:
            return lane
    return None


def multipliers_for(round_: ChickenRound) -> list[Decimal]:
    return lane_multipliers(round_.lanes, round_.hit_chance, round_.house_edge)


def road_length(bet: int, hit: Decimal, house_edge: Decimal, max_payout: int) -> int:
    """Lanes in a round: the last lane whose win fits under max_payout and whose multiplier fits
    under MAX_MULTIPLIER (at most MAX_LANES; 0 = even lane 1 would pass the cap)."""
    survive = Decimal(1) - Decimal(hit)
    keep = Decimal(1) - Decimal(house_edge)
    for lane in range(1, MAX_LANES + 1):
        multiplier = fair.floor_cents(keep / survive**lane)
        if bet * multiplier > max_payout or multiplier >= MAX_MULTIPLIER:
            return lane - 1
    return MAX_LANES


def ends_at_cap(round_: ChickenRound) -> bool:
    """Whether the road ends because one more lane would pass the payout cap (not MAX_LANES, nor a
    fixed road from before)."""
    following = lane_multipliers(round_.lanes + 1, round_.hit_chance, round_.house_edge)[-1]
    return round_.bet * following > round_.max_payout


def payout_cap_lane(round_: ChickenRound, multipliers) -> int | None:
    """First lane whose win would reach max_payout: the round cashes out there by itself."""
    for lane, multiplier in enumerate(multipliers, start=1):
        if round_.bet * multiplier >= round_.max_payout:
            return lane
    return None


def place_bet(user, bet: int, difficulty: str, now=None) -> tuple[ChickenRound, int]:
    config = ChickenConfiguration.current()
    if not config.enabled:
        raise CrashError("بازی مرغ فراری فعلاً غیرفعال است.")
    if difficulty not in CHICKEN_DIFFICULTIES:
        raise CrashError("سطح بازی نامعتبر است.")
    if bet < config.min_bet or bet > config.max_bet:
        raise CrashError(f"مبلغ شرط باید بین {config.min_bet} و {config.max_bet} امتیاز باشد.")
    if bet >= config.max_payout:
        raise CrashError("این شرط از سقف برد بیشتر است.")
    _preview_lanes, hit = config.level(difficulty)
    lanes = road_length(bet, hit, config.house_edge, config.max_payout)
    if lanes == 0:
        raise CrashError("با این شرط، برد همان خط اول از سقف برد بیشتر می‌شود؛ شرط را کمتر کن.")

    customer = customer_for(user)
    account = points_account(user)
    if account is None:
        raise CrashError("کیف امتیازی برای کاربر یافت نشد.")

    with transaction.atomic():
        account = TokenWalletAccount.objects.select_for_update().get(pk=account.pk)
        if ChickenRound.objects.filter(customer=customer, status=ChickenRound.Status.ACTIVE).exists():
            raise CrashError("یک دست هنوز در جریان است.")
        if account.status != TokenWalletAccount.WalletStatus.VALID:
            raise CrashError("کیف امتیاز شما فعال نیست.")
        if account.amount < bet:
            raise CrashError("امتیاز کافی برای این شرط نداری.")

        seed = seed_for(customer)
        nonce = seed.next_nonce
        seed.next_nonce = nonce + 1
        seed.save(update_fields=["next_nonce", "update_time"])

        server_seed = fair.new_server_seed()
        round_ = ChickenRound.objects.create(
            customer=customer,
            token_account=account,
            bet=bet,
            difficulty=difficulty,
            lanes=lanes,
            hit_chance=hit,
            house_edge=config.house_edge,
            max_payout=config.max_payout,
            server_seed=server_seed,
            server_seed_hash=fair.hash_seed(server_seed),
            client_seed=seed.client_seed,
            nonce=nonce,
            hit_lane=hit_lane(server_seed, seed.client_seed, nonce, lanes, hit),
        )
        TokenWalletAccount.objects.filter(pk=account.pk).update(amount=F("amount") - bet)

    return round_, account.amount - bet


def _locked_round(user, round_id) -> ChickenRound:
    round_ = (
        ChickenRound.objects.select_for_update()
        .filter(pk=round_id, customer=customer_for(user))
        .first()
    )
    if round_ is None:
        raise RoundNotFound()
    return round_


def _win(round_: ChickenRound, multipliers, now):
    multiplier = multipliers[round_.step - 1]
    round_.status = ChickenRound.Status.WON
    round_.cashout_multiplier = multiplier
    round_.payout = min(int(fair.floor_cents(Decimal(round_.bet) * multiplier)), round_.max_payout)
    round_.settled_at = now
    round_.save(
        update_fields=["status", "step", "cashout_multiplier", "payout", "settled_at", "update_time"]
    )
    TokenWalletAccount.objects.filter(pk=round_.token_account_id).update(
        amount=F("amount") + round_.payout
    )


def step(user, round_id, to=None, now=None, from_step=None) -> ChickenRound:
    """Cross one lane, or with `to` cross up to that lane and cash out there (Go Max = lanes).

    `from_step` is the lane the player sees; if it differs (a lost response), nothing moves, so a
    retried tap can never cross a lane the player did not choose.
    """
    now = now or timezone.now()
    with transaction.atomic():
        round_ = _locked_round(user, round_id)
        if round_.status != ChickenRound.Status.ACTIVE:
            return round_  # a repeated click after the round ended
        if from_step is not None and from_step != round_.step:
            raise StaleRound()
        target = round_.step + 1 if to is None else int(to)
        if not round_.step < target <= round_.lanes:
            raise CrashError("شمارهٔ خط نامعتبر است.")

        multipliers = multipliers_for(round_)
        cap_lane = payout_cap_lane(round_, multipliers)
        while round_.step < target:
            lane = round_.step + 1
            round_.step = lane
            if round_.hit_lane == lane:
                round_.status = ChickenRound.Status.LOST
                round_.settled_at = now
                round_.save(update_fields=["status", "step", "settled_at", "update_time"])
                return round_
            if lane == round_.lanes or (cap_lane is not None and lane >= cap_lane):
                _win(round_, multipliers, now)
                return round_

        if to is not None:
            _win(round_, multipliers, now)
        else:
            round_.save(update_fields=["step", "update_time"])
    return round_


def cash_out(user, round_id, now=None) -> ChickenRound:
    now = now or timezone.now()
    with transaction.atomic():
        round_ = _locked_round(user, round_id)
        if round_.status != ChickenRound.Status.ACTIVE:
            return round_
        if round_.step == 0:
            raise CrashError("اول حداقل از یک خط رد شو.")
        _win(round_, multipliers_for(round_), now)
    return round_


def round_payload(round_: ChickenRound) -> dict:
    finished = round_.status != ChickenRound.Status.ACTIVE
    multipliers = multipliers_for(round_)
    current = multipliers[round_.step - 1] if round_.step else None
    following = multipliers[round_.step] if round_.step < round_.lanes else None
    return {
        "id": str(round_.id),
        "bet": round_.bet,
        "difficulty": round_.difficulty,
        "lanes": round_.lanes,
        "multipliers": [str(m) for m in multipliers],
        "step": round_.step,
        "status": round_.status,
        "current_multiplier": str(current) if current is not None else None,
        "next_multiplier": str(following) if following is not None else None,
        "cashout_multiplier": (
            str(round_.cashout_multiplier) if round_.cashout_multiplier is not None else None
        ),
        "payout": round_.payout,
        "max_payout": round_.max_payout,
        "ends_at_cap": ends_at_cap(round_),
        "server_seed_hash": round_.server_seed_hash,
        "client_seed": round_.client_seed,
        "nonce": round_.nonce,
        "hit_chance": str(round_.hit_chance),
        "revealed": finished,
        "hit_lane": round_.hit_lane if finished else None,
        "server_seed": round_.server_seed if finished else None,
        "create_time": round_.create_time.isoformat(),
    }
