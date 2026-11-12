"""1 coin = 1 toman (2026-11-12, the owner's decision).

Until now a point (now «سکه») was worth about 100 toman; from here 1 coin = 1 toman. So that every player
keeps what they had, every coin amount that is a CURRENT value is multiplied by 100:

- each player's coin balance, with one visible ledger row («تبدیل به سکهٔ جدید») per player, so the
  balance and the transaction history keep adding up (the old rows stay as they were);
- what the app pays and charges from now on: Sudoku rewards (ScoreConfiguration), missions and
  mysteries (stage and finish rewards, budgets), the wheel (price, bet range, coin prizes and their
  names), Crash and Chicken (bet range and caps), Game Master drafts/versions, lotteries (ticket price,
  coins spent), saved system settings (ad and profile rewards, negative limit);
- the coin packages become face value: coins = the package's (original) price in toman.

Entry fees (GameConfiguration.play_cost): a price already set is ×100; a free game gets the owner's
default (Sudoku and 2048: 2,000; Pantomime, Dowr, Spy: 5,000).

History rows (ledger, rounds, spins, runs) are records of the past and are NOT changed.
Irreversible by design: the reverse is a no-op (a rollback of the code keeps the new values).
"""

import re

from django.db import migrations
from django.db.models import F

X = 100
FEES = {"sudoku": 2000, "game_2048": 2000, "pantomime": 5000, "dowr": 5000, "spy": 5000}
FA = str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹")
EN = str.maketrans("۰۱۲۳۴۵۶۷۸۹", "0123456789")


def fa(n: int) -> str:
    return f"{int(n):,}".replace(",", "٬").translate(FA)


def scale_definition(d):
    """A Game Master definition (draft or version): stage points, finish reward, budget."""
    if not isinstance(d, dict):
        return d, False
    changed = False
    for key in ("finish_points", "budget_points"):
        if isinstance(d.get(key), (int, float)) and d[key]:
            d[key] = int(d[key]) * X
            changed = True
    for stage in d.get("stages") or []:
        if isinstance(stage, dict) and isinstance(stage.get("points"), (int, float)) and stage["points"]:
            stage["points"] = int(stage["points"]) * X
            changed = True
    return d, changed


def prize_name(name: str, amount: int) -> str:
    m = re.fullmatch(r"\s*([0-9۰-۹٬,]+)\s*امتیاز\s*", name or "")
    if m:
        return f"{fa(amount)} سکه"
    return (name or "").replace("امتیاز", "سکه")


def forward(apps, schema_editor):
    get = apps.get_model

    # ── balances: ×100 with one ledger row each ──
    Account = get("wallet", "TokenWalletAccount")
    Activity = get("wallet", "ActivityTransaction")
    for acc in Account.objects.filter(token__symbol="L").exclude(amount=0).select_related("wallet__owner"):
        owner = acc.wallet.owner
        customer = get("users", "Customer").objects.filter(user_id=owner.pk).first() if owner else None
        added = int(acc.amount) * (X - 1)
        if customer is not None:
            Activity.objects.create(
                customer=customer,
                section="coin_rescale",
                action_type=f"x{X}:{acc.pk}",
                score_value=added,
                reward_data={"factor": X, "before": int(acc.amount)},
                metadata={"reason": "1 coin = 1 toman"},
                status="completed",
                description=f"Coin rescale x{X}",
            )
        # (a migration's models send no signals: the balance moves here, exactly once)
        Account.objects.filter(pk=acc.pk).update(amount=F("amount") * X)

    # ── what the app pays and charges from now on ──
    get("configuration", "ScoreConfiguration").objects.update(score_value=F("score_value") * X)
    get("missions", "Mission").objects.update(points=F("points") * X)
    Mystery = get("missions", "Mystery")
    Mystery.objects.update(finish_points=F("finish_points") * X)
    Mystery.objects.exclude(budget_points=None).update(budget_points=F("budget_points") * X)
    get("missions", "MysteryStep").objects.update(points=F("points") * X)
    for name in ("CrashConfiguration", "ChickenConfiguration"):
        get("crash", name).objects.update(min_bet=F("min_bet") * X, max_bet=F("max_bet") * X, max_payout=F("max_payout") * X)
    get("lottery", "LotteryWheel").objects.update(cost_per_spin=F("cost_per_spin") * X, min_bet=F("min_bet") * X, max_bet=F("max_bet") * X)
    for prize in get("lottery", "LotteryWheelPrize").objects.filter(prize_type="recharge"):
        prize.prize_amount = int(prize.prize_amount) * X
        prize.name = prize_name(prize.name, prize.prize_amount)[:100]
        prize.save(update_fields=["prize_amount", "name"])
    get("lottery", "Lottery").objects.update(ticket_price=F("ticket_price") * X, tickets_points_spent=F("tickets_points_spent") * X)

    Setting = get("configuration", "SystemConfiguration")
    for key in ("AD_REWARD_POINTS", "COMPLETE_PROFILE_REWARD_POINTS", "WALLET_MAX_NEGATIVE_POINTS"):
        for row in Setting.objects.filter(key=key):
            # Both the value and the row's own default (used when the value is empty).
            changed = []
            for field in ("value", "default_value"):
                raw = str(getattr(row, field) or "").strip().translate(EN)
                if raw.lstrip("-").isdigit() and int(raw):
                    setattr(row, field, str(int(raw) * X))
                    changed.append(field)
            if changed:
                row.save(update_fields=changed)

    for model in ("Game", "GameVersion"):
        field = "draft" if model == "Game" else "definition"
        for obj in get("gamemaster", model).objects.all():
            value, changed = scale_definition(getattr(obj, field))
            if changed:
                setattr(obj, field, value)
                obj.save(update_fields=[field])
    get("gamemaster", "GameBudgetLedger").objects.update(points=F("points") * X)

    # ── entry fees ──
    Config = get("configuration", "GameConfiguration")
    Config.objects.exclude(play_cost=0).update(play_cost=F("play_cost") * X)
    for game, fee in FEES.items():
        rows = Config.objects.filter(game_name=game)
        if rows.exists():
            rows.filter(play_cost=0).update(play_cost=fee)
        else:
            Config.objects.create(game_name=game, difficulty_level=None, play_cost=fee, is_active=True)

    # ── coin packages: face value ──
    Package = get("coins", "CoinPackage")
    for p in Package.objects.all():
        p.coins = p.original_price_toman or p.price_toman
        p.save(update_fields=["coins"])

    # Settings are cached (an hour) with what they resolved to before — also a code default that has
    # changed (ad reward 5 → 500): dropped now, so the new values apply at once.
    try:
        from apps.configuration.models.system_configuration import SystemConfiguration as Live  # pylint: disable=import-outside-toplevel

        for key in ("AD_REWARD_POINTS", "COMPLETE_PROFILE_REWARD_POINTS", "WALLET_MAX_NEGATIVE_POINTS"):
            Live.objects.invalidate(key)
    except Exception:  # pylint: disable=broad-except  (no cache in this environment: nothing to drop)
        pass


class Migration(migrations.Migration):
    dependencies = [
        ("coins", "0002_default_packages"),
        ("wallet", "0035_adivery_callback_attempt"),
        ("users", "0026_legacy_profile_rewards"),
        ("configuration", "0006_gameconfiguration_play_cost"),
        ("missions", "0008_mystery_edition_mystery_grace_ends_at_and_more"),
        ("crash", "0006_round_request_id"),
        ("lottery", "0026_alter_lotterywheel_cost_per_spin"),
        ("gamemaster", "0005_series_and_timer"),
    ]

    operations = [migrations.RunPython(forward, migrations.RunPython.noop)]
