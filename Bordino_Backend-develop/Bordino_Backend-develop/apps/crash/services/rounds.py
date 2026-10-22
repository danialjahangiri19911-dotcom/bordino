"""Crash rounds: bet, cash out, settle.

Money rules:
- The bet and the payout move the player's own points account (picked here, never sent by the
  client), with the account row locked and the balance changed by F() expressions.
- A round is settled exactly once, under a row lock on the round.
- The crash point and server seed leave the server only after the curve has reached the crash
  point, so nothing the client receives can predict a running round.
"""

from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import F
from django.utils import timezone

from apps.crash.models import CrashConfiguration, CrashRound, CrashSeed
from apps.crash.services import fair
from apps.users.models import Customer
from apps.wallet.models import TokenWalletAccount
from apps.wallet.services import balance

MIN_TARGET = Decimal("1.01")


class CrashError(Exception):
    def __init__(self, message):
        super().__init__(message)
        self.message = message


class RoundNotFound(CrashError):
    def __init__(self):
        super().__init__("دست پیدا نشد.")


class StaleRound(CrashError):
    """The client acted on an out-of-date view of the round (e.g. a lost response)."""

    def __init__(self):
        super().__init__("وضعیت دست تغییر کرده بود؛ به‌روز شد. دوباره امتحان کن.")


def _ms(delta: timedelta) -> float:
    return delta.total_seconds() * 1000


def crash_at(round_: CrashRound):
    return round_.started_at + timedelta(milliseconds=fair.ms_to_reach(round_.crash_point))


def wake_at(round_: CrashRound):
    """When a long-poll should answer: at the crash, or earlier at the moment the round wins on
    its own (auto target or payout cap), so the win is confirmed without waiting for the crash.
    Answering at the target reveals nothing new: the curve has visibly reached it by then."""
    end = crash_at(round_)
    target = round_.target_multiplier
    if round_.status == CrashRound.Status.ACTIVE and target <= round_.crash_point:
        end = min(end, round_.started_at + timedelta(milliseconds=fair.ms_to_reach(target)))
    return end


def is_revealed(round_: CrashRound, now=None) -> bool:
    now = now or timezone.now()
    return round_.status != CrashRound.Status.ACTIVE and now >= crash_at(round_)


def customer_for(user) -> Customer:
    try:
        return user.customer
    except Customer.DoesNotExist as exc:
        raise CrashError("پروفایل کاربری پیدا نشد.") from exc


def points_account(user):
    """The player's points (L) account: the same one every other points payment uses."""
    return balance.points_account(user)


def seed_for(customer: Customer) -> CrashSeed:
    seed, _ = CrashSeed.objects.get_or_create(
        customer=customer, defaults={"client_seed": fair.new_client_seed()}
    )
    return seed


def place_bet(user, bet: int, auto_cashout=None, now=None) -> tuple[CrashRound, int]:
    config = CrashConfiguration.current()
    if not config.enabled:
        raise CrashError("بازی انفجار فعلاً غیرفعال است.")
    if bet < config.min_bet or bet > config.max_bet:
        raise CrashError(f"مبلغ شرط باید بین {config.min_bet} و {config.max_bet} امتیاز باشد.")

    payout_cap = min(fair.floor_cents(Decimal(config.max_payout) / bet), config.max_multiplier)
    if payout_cap < MIN_TARGET:
        raise CrashError("این شرط از سقف برد بیشتر است.")
    if auto_cashout is not None:
        auto_cashout = fair.floor_cents(auto_cashout)
        if auto_cashout < MIN_TARGET or auto_cashout > config.max_multiplier:
            raise CrashError(f"برداشت خودکار باید بین ۱٫۰۱ و {config.max_multiplier} باشد.")

    customer = customer_for(user)
    account = points_account(user)
    if account is None:
        raise CrashError("کیف امتیازی برای کاربر یافت نشد.")

    now = now or timezone.now()
    with transaction.atomic():
        # A finished round may still owe a payout; settle it before reading the balance.
        settle_due(customer=customer, now=now)
        # Serialises everything this player does: two bets cannot both pass the balance check.
        account = TokenWalletAccount.objects.select_for_update().get(pk=account.pk)
        if CrashRound.objects.filter(customer=customer, status=CrashRound.Status.ACTIVE).exists():
            raise CrashError("یک دست هنوز در جریان است.")
        if account.amount < bet:
            raise CrashError("امتیاز کافی برای این شرط نداری.")

        seed = seed_for(customer)
        nonce = seed.next_nonce
        seed.next_nonce = nonce + 1
        seed.save(update_fields=["next_nonce", "update_time"])

        server_seed = fair.new_server_seed()
        round_ = CrashRound.objects.create(
            customer=customer,
            token_account=account,
            bet=bet,
            auto_cashout=auto_cashout,
            payout_cap_multiplier=payout_cap,
            house_edge=config.house_edge,
            max_multiplier=config.max_multiplier,
            server_seed=server_seed,
            server_seed_hash=fair.hash_seed(server_seed),
            client_seed=seed.client_seed,
            nonce=nonce,
            crash_point=fair.crash_point(
                server_seed, seed.client_seed, nonce, config.house_edge, config.max_multiplier
            ),
            started_at=now + timedelta(milliseconds=fair.START_DELAY_MS),
        )
        TokenWalletAccount.objects.filter(pk=account.pk).update(amount=F("amount") - bet)

    return round_, account.amount - bet


def _settle(round_: CrashRound, now, manual: bool) -> bool:
    """Settle a locked ACTIVE round if its outcome is known at `now`. Returns True if settled."""
    elapsed = _ms(now - round_.started_at)
    target = round_.target_multiplier

    if target <= round_.crash_point and elapsed >= fair.ms_to_reach(target):
        win_at = target
    elif manual and elapsed >= 0 and fair.multiplier_at(elapsed) < round_.crash_point:
        win_at = fair.multiplier_at(elapsed)
    elif elapsed >= fair.ms_to_reach(round_.crash_point):
        win_at = None
    else:
        return False

    round_.settled_at = now
    if win_at is None:
        round_.status = CrashRound.Status.LOST
        round_.save(update_fields=["status", "settled_at", "update_time"])
        return True

    round_.status = CrashRound.Status.WON
    round_.cashout_multiplier = win_at
    round_.payout = int(fair.floor_cents(Decimal(round_.bet) * win_at))
    round_.save(
        update_fields=["status", "cashout_multiplier", "payout", "settled_at", "update_time"]
    )
    TokenWalletAccount.objects.filter(pk=round_.token_account_id).update(
        amount=F("amount") + round_.payout
    )
    return True


def cash_out(user, round_id, now=None) -> CrashRound:
    customer = customer_for(user)
    now = now or timezone.now()
    with transaction.atomic():
        round_ = (
            CrashRound.objects.select_for_update()
            .filter(pk=round_id, customer=customer)
            .first()
        )
        if round_ is None:
            raise RoundNotFound()
        if round_.status != CrashRound.Status.ACTIVE:
            return round_  # already settled (auto cash-out, crash, or a repeated click)
        if now < round_.started_at:
            raise CrashError("دست هنوز شروع نشده است.")
        _settle(round_, now, manual=True)
    return round_


def settle_due(customer=None, now=None) -> int:
    """Settle every ACTIVE round whose outcome is already decided (auto target or crash)."""
    now = now or timezone.now()
    active = CrashRound.objects.filter(status=CrashRound.Status.ACTIVE, started_at__lte=now)
    if customer is not None:
        active = active.filter(customer=customer)
    settled = 0
    for round_id in active.values_list("pk", flat=True):
        with transaction.atomic():
            round_ = (
                CrashRound.objects.select_for_update()
                .filter(pk=round_id, status=CrashRound.Status.ACTIVE)
                .first()
            )
            if round_ is not None and _settle(round_, now, manual=False):
                settled += 1
    return settled


def get_round(user, round_id, now=None) -> CrashRound:
    customer = customer_for(user)
    round_ = CrashRound.objects.filter(pk=round_id, customer=customer).first()
    if round_ is None:
        raise RoundNotFound()
    if round_.status == CrashRound.Status.ACTIVE:
        settle_due(customer=customer, now=now)
        round_.refresh_from_db()
    return round_


def round_payload(round_: CrashRound, now=None) -> dict:
    now = now or timezone.now()
    revealed = is_revealed(round_, now)
    return {
        "id": str(round_.id),
        "bet": round_.bet,
        "auto_cashout": str(round_.auto_cashout) if round_.auto_cashout is not None else None,
        "target_multiplier": str(round_.target_multiplier),
        "status": round_.status,
        "cashout_multiplier": (
            str(round_.cashout_multiplier) if round_.cashout_multiplier is not None else None
        ),
        "payout": round_.payout,
        "started_at": round_.started_at.isoformat(),
        "server_seed_hash": round_.server_seed_hash,
        "client_seed": round_.client_seed,
        "nonce": round_.nonce,
        "house_edge": str(round_.house_edge),
        "max_multiplier": str(round_.max_multiplier),
        "revealed": revealed,
        "crash_point": str(round_.crash_point) if revealed else None,
        "server_seed": round_.server_seed if revealed else None,
        "create_time": round_.create_time.isoformat(),
    }
