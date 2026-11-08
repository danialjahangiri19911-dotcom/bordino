"""The creator's points for a game's players.

At publication the whole budget leaves the creator's points wallet (one ActivityTransaction of −budget,
"reserve"). The mission engine starts a player only while the budget still pays a full game for every
player who started (mystery.funded_runs), so a payout is always covered; each payout is booked here
("spend"). When the game ends, what no player can still win goes back to the creator ("release").
"""

from django.db import transaction
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


def summary(version: GameVersion) -> dict:
    rows = dict(GameBudgetLedger.objects.filter(version=version).values_list("kind").annotate(n=Sum("points")).values_list("kind", "n"))
    reserved, spent, released = rows.get(Kind.RESERVE, 0), rows.get(Kind.SPEND, 0), rows.get(Kind.RELEASE, 0)
    return {"reserved": reserved, "spent": spent, "released": released, "left": reserved - spent - released}


def outstanding(version: GameVersion) -> int:
    """What the players still playing can still win (kept back from a release)."""
    mystery = getattr(version, "mystery", None)
    if mystery is None or not mystery.is_active:
        return 0
    from apps.missions.mystery import max_run_points  # pylint: disable=import-outside-toplevel

    full = max_run_points(mystery)
    active = MysteryRun.objects.filter(mystery=mystery, status=MysteryRun.Status.ACTIVE)
    return sum(max(0, full - r.points_earned) for r in active)


def release(version: GameVersion, reason: str = "end"):
    """Gives the creator back what is left (the game ended, was archived or replaced). Once per version."""
    with transaction.atomic():
        GameVersion.objects.select_for_update().filter(pk=version.pk).first()
        key = f"release:{version.pk}"
        if GameBudgetLedger.objects.filter(key=key).exists():
            return None
        left = summary(version)["left"] - outstanding(version)
        if left <= 0:
            return None
        user = version.game.owner.user
        tx = ActivityTransaction.objects.create(
            customer=user.customer,
            section=SECTION,
            action_type=f"gm-release:{version.pk}",
            score_value=left,
            reward_data={"score": left},
            metadata={"game": str(version.game_id), "reason": reason, "title": f"برگشت بودجهٔ بازی «{version.game.title}»"},
            status=ActivityTransaction.Status.COMPLETED,
            description=f"Game Master budget back: {version.game.title}"[:255],
        )
        return GameBudgetLedger.objects.create(game=version.game, version=version, kind=Kind.RELEASE, points=left, key=key, activity_transaction=tx)
