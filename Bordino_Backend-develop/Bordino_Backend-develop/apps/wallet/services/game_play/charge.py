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

    @staticmethod
    def price(game_name: str, difficulty: str | None = None) -> int:
        """The play's price. With a difficulty: that difficulty's own active configuration only (the
        app starts a level only when it has one) — never another difficulty's price. Without one:
        the game's general configuration (no difficulty), else its first."""
        configs = list(GameConfigurationQueryRepository.filter_by_game_name(game_name=game_name))
        if not difficulty:
            config = next((c for c in configs if not c.difficulty_level), None) or (configs[0] if configs else None)
        else:
            config = next((c for c in configs if c.difficulty_level == difficulty), None)
            if config is None and configs:
                raise ValidationError(_("این سطح بازی فعلاً فعال نیست."))
        return int(config.play_cost) if config else 0

    @dataclass
    class ChargeResult:
        game_name: str
        cost: int
        new_amount: int
        # True when `request_id` was charged before: this answer is that charge's, nothing new.
        repeated: bool = False

    @transaction.atomic
    def charge(
        self, user, game_name: str, request_id: str | None = None, difficulty: str | None = None
    ) -> "GamePlayChargeService.ChargeResult":
        game_name = (game_name or "").lower().strip()
        difficulty = (difficulty or "").strip()

        cost = self.price(game_name, difficulty)

        # The points (L) account, locked: two plays at once cannot both pass the balance check.
        account = balance.points_account(user, lock=True)
        if account is None:
            raise ValidationError(_("کیفِ امتیازی برای کاربر یافت نشد."))

        if request_id:
            # Under the account lock: a retry (or two copies at once) finds the first charge.
            earlier = GamePlayCharge.objects.filter(customer=user.customer, request_id=request_id).first()
            if earlier:
                # The same play only: another game or another level's price is not this request.
                if earlier.game_name != game_name or earlier.difficulty != difficulty:
                    raise ValidationError(_("این درخواست قبلاً برای بازی دیگری ثبت شده است."))
                return self.ChargeResult(
                    game_name=game_name, cost=earlier.cost, new_amount=int(account.amount), repeated=True
                )

        if cost > 0:
            balance.check_debit(account, cost, _("امتیازِ کافی برای بازی نداری."))
            balance.add_points(account, -cost)
        # Recorded even when free: it is the play's history row and its proof (activity rewards).
        GamePlayCharge.objects.create(
            customer=user.customer, token_account=account, game_name=game_name, difficulty=difficulty,
            cost=cost, request_id=request_id or None,
        )

        return self.ChargeResult(
            game_name=game_name,
            cost=cost,
            new_amount=int(account.amount) - cost,
        )
