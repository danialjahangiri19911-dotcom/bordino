from dataclasses import dataclass

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils.translation import gettext_lazy as _

from apps.configuration.repositories.game import GameConfigurationQueryRepository
from apps.wallet.models import TokenWalletAccount
from apps.wallet.repositories.wallet.query import WalletQueryRepository
from apps.wallet.services.utils import (
    get_max_negative_limit,
    would_deduction_exceed_negative_limit,
)


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

        wallets = WalletQueryRepository.customer_wallet(user)
        account = (
            TokenWalletAccount.objects.filter(wallet__in=wallets)
            .select_related("wallet")
            .first()
        )
        if account is None:
            raise ValidationError(_("کیفِ امتیازی برای کاربر یافت نشد."))

        if cost > 0:
            if would_deduction_exceed_negative_limit(
                account.amount, cost, get_max_negative_limit(account)
            ):
                raise ValidationError(_("امتیازِ کافی برای بازی نداری."))
            account.amount -= cost
            account.save()

        return self.ChargeResult(
            game_name=game_name,
            cost=cost,
            new_amount=int(account.amount),
        )
