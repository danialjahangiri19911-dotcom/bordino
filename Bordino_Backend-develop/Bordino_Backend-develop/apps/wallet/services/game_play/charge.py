from dataclasses import dataclass

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils.translation import gettext_lazy as _

from apps.configuration.repositories.game import GameConfigurationQueryRepository
from apps.wallet.services import balance


class GamePlayChargeService:
    """کسرِ هزینهٔ هر بار بازی از کیفِ امتیازِ کاربر.

    مقدارِ هزینه از `GameConfiguration.play_cost` همان بازی خوانده می‌شود تا
    در ادمین برای هر بازی جداگانه قابلِ تنظیم باشد (سودوکو=۱، ۲۰۴۸=۲).
    """

    @dataclass
    class ChargeResult:
        game_name: str
        cost: int
        new_amount: int

    @transaction.atomic
    def charge(self, user, game_name: str) -> "GamePlayChargeService.ChargeResult":
        game_name = (game_name or "").lower().strip()

        game_config = GameConfigurationQueryRepository.filter_by_game_name(
            game_name=game_name
        ).first()
        cost = int(game_config.play_cost) if game_config else 0

        # The points (L) account, locked: two plays at once cannot both pass the balance check.
        account = balance.points_account(user, lock=True)
        if account is None:
            raise ValidationError(_("کیفِ امتیازی برای کاربر یافت نشد."))

        if cost > 0:
            balance.check_debit(account, cost, _("امتیازِ کافی برای بازی نداری."))
            balance.add_points(account, -cost)

        return self.ChargeResult(
            game_name=game_name,
            cost=cost,
            new_amount=int(account.amount) - cost,
        )
