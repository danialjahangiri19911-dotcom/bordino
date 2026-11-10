"""The creator's points for a game's players.

At publication the whole budget leaves the creator's points wallet (one ActivityTransaction of −budget,
"reserve"). The mission engine starts a player only while the budget still pays a full game for every
player who started (mystery.funded_runs), so a payout is always covered; each payout is booked here
("spend"). When the game ends, what no player can still win goes back to the creator ("release").
"""

from django.db import transaction
from django.utils import timezone
from django.db.models import Sum

from apps.gamemaster.models import Game, GameBudgetLedger, GameVersion
from apps.missions.models import MysteryRun
from apps.wallet.models.transactions.activity import ActivityTransaction
from apps.wallet.services import balance

SECTION = "gamemaster"
Kind = GameBudgetLedger.Kind


class BudgetError(Exception):
    def __init__(self, message: str, code: str = "budget"):
        super().__init__(message)
        self.message = message
        self.code = code


def reserve(game: Game, version: GameVersion, points: int):
    """Takes the budget from the creator's points wallet (once per version). Call in a transaction."""
    if points <= 0:
        return None
    key = f"reserve:{version.pk}"
    if GameBudgetLedger.objects.filter(key=key).exists():
        return None
    user = game.owner.user
    account = balance.points_account(user, lock=True)
    if account is None or account.amount < points:
        have = int(account.amount) if account else 0
        raise BudgetError(f"برای بودجهٔ جایزه‌ها {points} امتیاز لازم است؛ موجودی امتیاز تو {have} است.", "insufficient_points")
    tx = ActivityTransaction.objects.create(
        customer=user.customer,
        section=SECTION,
        action_type=f"gm-reserve:{version.pk}",
        score_value=-points,
        reward_data={"score": -points},
        metadata={"game": str(game.pk), "title": f"بودجهٔ جایزهٔ بازی «{game.title}»"},
        status=ActivityTransaction.Status.COMPLETED,
        description=f"Game Master budget: {game.title}"[:255],
    )
    return GameBudgetLedger.objects.create(game=game, version=version, kind=Kind.RESERVE, points=points, key=key, activity_transaction=tx)


def on_payout(run: MysteryRun, step, points: int, bonus: int):
    """The mission engine paid a player of a creator's game: booked against its budget."""
    mystery = run.mystery
    if mystery.source_version_id is None or not (points or bonus):
        return
    version = GameVersion.objects.filter(pk=mystery.source_version_id).select_related("game").first()
    if version is None:
        return
    GameBudgetLedger.objects.get_or_create(
        key=f"spend:{run.pk}:{step.pk}",
        defaults={"game": version.game, "version": version, "kind": Kind.SPEND, "points": points + bonus},
    )
    _warn_if_low(version, mystery)


# When only this many more players can still start, the creator is told (once per version).
LOW_PLAYERS = 2


def _warn_if_low(version: GameVersion, mystery):
    from apps.gamemaster.models import GameAuditLog  # pylint: disable=import-outside-toplevel
    from apps.missions.mystery import funded_runs  # pylint: disable=import-outside-toplevel

    funded = funded_runs(mystery)
    if funded is None or funded - mystery.runs.count() > LOW_PLAYERS:
        return
    if GameAuditLog.objects.filter(game=version.game, action="budget_low", data__version=version.number).exists():
        return
    GameAuditLog.objects.create(game=version.game, action="budget_low", data={"version": version.number})
    from apps.gamemaster.services import _notify  # pylint: disable=import-outside-toplevel

    _notify(version.game, "بودجهٔ بازی تو رو به پایان است", f"«{version.game.title}»: بودجه فقط برای چند بازیکن دیگر کافی است.")


def summary(version: GameVersion) -> dict:
    rows = dict(GameBudgetLedger.objects.filter(version=version).values_list("kind").annotate(n=Sum("points")).values_list("kind", "n"))
    reserved, spent, released = rows.get(Kind.RESERVE, 0), rows.get(Kind.SPEND, 0), rows.get(Kind.RELEASE, 0)
    return {"reserved": reserved, "spent": spent, "released": released, "left": reserved - spent - released}


def outstanding(version: GameVersion) -> int | None:
    """What the players can still win from this version (kept back from a release); None while its
    game still takes new players (then nothing is free yet). Always read fresh from the database: a
    publication may have just moved its dates (an extension), and a cached copy would see it ended."""
    from apps.missions.models import Mystery  # pylint: disable=import-outside-toplevel

    mystery = Mystery.objects.filter(source_version_id=version.pk).first()
    if mystery is None or not mystery.is_active:
        return 0
    now = timezone.now()
    # Ended for good (its end, and the end of its grace, passed): nobody can win anything more.
    last = max(mystery.ends_at, mystery.grace_ends_at or mystery.ends_at) if mystery.ends_at else None
    if last is not None and last <= now:
        return 0
    started = MysteryRun.objects.filter(mystery=mystery).count()
    taking_new = (mystery.ends_at is None or mystery.ends_at > now) and (mystery.capacity is None or started < mystery.capacity)
    if taking_new:
        return None
    from apps.missions.mystery import max_run_points  # pylint: disable=import-outside-toplevel

    full = max_run_points(mystery)
    active = MysteryRun.objects.filter(mystery=mystery, status=MysteryRun.Status.ACTIVE)
    return sum(max(0, full - r.points_earned) for r in active)


def release(version: GameVersion, reason: str = "end"):
    """Gives the creator back what no player can still win (the game ended, was archived or
    replaced). May run again later: each time only what became free since (players who were still
    playing a replaced version and finished or stopped), under the version's lock."""
    with transaction.atomic():
        version = GameVersion.objects.select_for_update().select_related("game__owner__user").filter(pk=version.pk).first()
        if version is None:
            return None
        held = outstanding(version)
        if held is None:
            return None  # (still taking new players: its whole budget may still be won)
        left = summary(version)["left"] - held
        if left <= 0:
            return None
        n = GameBudgetLedger.objects.filter(version=version, kind=Kind.RELEASE).count() + 1
        key = f"release:{version.pk}:{n}"
        user = version.game.owner.user
        tx = ActivityTransaction.objects.create(
            customer=user.customer,
            section=SECTION,
            action_type=f"gm-release:{version.pk}:{n}",
            score_value=left,
            reward_data={"score": left},
            metadata={"game": str(version.game_id), "reason": reason, "title": f"برگشت بودجهٔ بازی «{version.game.title}»"},
            status=ActivityTransaction.Status.COMPLETED,
            description=f"Game Master budget back: {version.game.title}"[:255],
        )
        return GameBudgetLedger.objects.create(game=version.game, version=version, kind=Kind.RELEASE, points=left, key=key, activity_transaction=tx)
