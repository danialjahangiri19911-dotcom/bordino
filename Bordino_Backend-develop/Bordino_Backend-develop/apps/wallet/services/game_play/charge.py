from dataclasses import dataclass

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils.translation import gettext_lazy as _

from apps.configuration.repositories.game import GameConfigurationQueryRepository
from apps.wallet.models import GamePlayCharge
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
    def charge(self, user, game_name: str, request_id: str | None = None) -> "GamePlayChargeService.ChargeResult":
        game_name = (game_name or "").lower().strip()

        game_config = GameConfigurationQueryRepository.filter_by_game_name(
            game_name=game_name
        ).first()
        cost = int(game_config.play_cost) if game_config else 0

        # The points (L) account, locked: two plays at once cannot both pass the balance check.
        account = balance.points_account(user, lock=True)
        if account is None:
            raise ValidationError(_("کیفِ امتیازی برای کاربر یافت نشد."))

        if request_id:
            # Under the account lock: a retry (or two copies at once) finds the first charge.
            earlier = GamePlayCharge.objects.filter(customer=user.customer, request_id=request_id).first()
            if earlier:
                if earlier.game_name != game_name:
                    raise ValidationError(_("این درخواست قبلاً برای بازی دیگری ثبت شده است."))
                return self.ChargeResult(game_name=game_name, cost=earlier.cost, new_amount=int(account.amount))

        if cost > 0:
            balance.check_debit(account, cost, _("امتیازِ کافی برای بازی نداری."))
            balance.add_points(account, -cost)
        # Recorded even when free: it is the play's history row and its proof (activity rewards).
        GamePlayCharge.objects.create(
            customer=user.customer, token_account=account, game_name=game_name, cost=cost,
            request_id=request_id or None,
        )

        return self.ChargeResult(
            game_name=game_name,
            cost=cost,
            new_amount=int(account.amount) - cost,
        )
