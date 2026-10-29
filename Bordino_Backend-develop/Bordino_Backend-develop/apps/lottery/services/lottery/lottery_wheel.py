import random
from dataclasses import dataclass

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import F, Sum
from django.utils.translation import gettext_lazy as _

from apps.lottery.models import (
    LotteryWheel,
    LotteryWheelPrize,
    LotteryWheelSpin,
    LotteryWheelSpinLog,
)
from apps.users.models import Customer
from apps.wallet.models import TokenWalletAccount
from apps.wallet.services.currency_wallet_account.transfer import (
    CurrencyWalletAccountTransferService,
)
from apps.wallet.services.transaction import TransactionService
from apps.wallet.services import balance


class LotteryWheelService:
    def __init__(self):
        self.transaction_service = TransactionService()
        self.currency_wallet_account_transfer_service = CurrencyWalletAccountTransferService()

    @dataclass
    class SpinWheelDTO:
        customer: Customer
        lottery_wheel: LotteryWheel
        token_wallet_account: TokenWalletAccount
        multiplier: int = 1
        # One id per spin the app starts; a retry with it gets the first spin back, not a new one.
        request_id: str | None = None

    def _validate_prizes(self, prizes):
        """Validate that prizes have valid probabilities"""
        if not prizes.exists():
            raise ValidationError(_("Lottery wheel must have at least one prize"))

        if any((prize.prize_amount or 0) < 0 for prize in prizes):
            raise ValidationError(_("A wheel prize cannot be negative."))
        total_probability = sum(prize.probability for prize in prizes)
        if total_probability != 100:
            raise ValidationError(_("Total probability of all prizes must equal 100"))
        # The multiplier moves chance from the prizes to the empty slice (select_prize), which
        # keeps the expected payout per spin the same at ×1…×5. Without an empty slice, ×5 would
        # simply pay five times more for the same cost.
        if not any(
            prize.prize_type == LotteryWheelPrize.PrizeType.EMPTY and prize.probability > 0
            for prize in prizes
        ):
            raise ValidationError(_("A wheel needs an empty slice with a chance above 0."))

    def select_prize(self, prizes, multiplier: int = 1):
        """
        انتخابِ تصادفیِ جایزه با درنظرگرفتنِ ضریبِ M:
        احتمالِ هر جایزه‌ی غیرپوچ = probability/M و سهمِ آزادشده به پوچ(ها) اضافه می‌شود.
        """
        prize_list = list(prizes)
        if not prize_list:
            return None

        multiplier = max(1, int(multiplier))
        empties = [p for p in prize_list if p.prize_type == LotteryWheelPrize.PrizeType.EMPTY]
        non_empties = [p for p in prize_list if p.prize_type != LotteryWheelPrize.PrizeType.EMPTY]

        weights = {}
        freed = 0.0
        for prize in non_empties:
            adjusted = prize.probability / multiplier
            weights[prize.id] = adjusted
            freed += prize.probability - adjusted

        if empties:
            base = sum(p.probability for p in empties)
            for prize in empties:
                share = (prize.probability / base * freed) if base > 0 else (freed / len(empties))
                weights[prize.id] = prize.probability + share
        # اگر پوچی نباشد، سهمِ آزادشده توزیع نمی‌شود و وزن‌ها همان نسبتِ کاهش‌یافته می‌مانند.

        total = sum(weights.values())
        if total <= 0:
            return prize_list[0]

        random_number = random.uniform(0, total)
        cumulative = 0.0
        for prize in prize_list:
            cumulative += weights.get(prize.id, 0)
            if random_number < cumulative:
                return prize

        return prize_list[-1]

    @transaction.atomic
    def spin_wheel(self, dto: SpinWheelDTO):
        """
        Spin the lottery wheel and award the selected prize to the customer.
        Returns the awarded prize or None if no prize was awarded.
        """

        prizes = dto.lottery_wheel.lottery_wheel_prizes.all()

        self._validate_prizes(prizes)

        # The spin limits again, under the wheel's row lock (wheel first, then the account, the
        # same order everywhere): two requests that both passed the serializer's check must not
        # both spin past the limit.
        wheel = LotteryWheel.objects.select_for_update().get(pk=dto.lottery_wheel.pk)
        # A retry of a spin that already happened is answered first — before the limits and the
        # wheel's state, which that very spin may have changed — with exactly what was paid then.
        # The same request id for another wheel or multiplier is not a retry: refused.
        if dto.request_id:
            earlier = (
                LotteryWheelSpinLog.objects.filter(customer=dto.customer, request_id=dto.request_id)
                .select_related("prize")
                .first()
            )
            if earlier:
                if earlier.lottery_wheel_id != wheel.pk or earlier.multiplier != max(1, int(dto.multiplier or 1)):
                    raise ValidationError(_("This request was already used for another spin."))
                prize = earlier.prize
                if prize and prize.prize_type != LotteryWheelPrize.PrizeType.EMPTY:
                    prize.prize_amount = (
                        earlier.paid_amount if earlier.paid_amount is not None else prize.prize_amount * earlier.multiplier
                    )
                return prize, LotteryWheelSpin.objects.get(lottery_wheel=wheel, customer=dto.customer)
        if wheel.status != LotteryWheel.Status.ACTIVE:
            raise ValidationError(_("This wheel is not active."))
        total = LotteryWheelSpin.objects.filter(lottery_wheel=wheel).aggregate(n=Sum("count"))["n"] or 0
        if total >= wheel.max_spins:
            raise ValidationError(_("Maximum spins for this wheel has been reached"))
        mine = (
            LotteryWheelSpin.objects.filter(lottery_wheel=wheel, customer=dto.customer)
            .values_list("count", flat=True)
            .first()
            or 0
        )
        if mine >= wheel.max_spins_per_customer:
            raise ValidationError(_("You have reached your maximum spins for this wheel"))
        # A cash prize needs the player's cash account: refuse before charging, rather than roll a
        # won spin back (and let a retry draw again).
        if any(p.prize_type == LotteryWheelPrize.PrizeType.CASH for p in prizes) and not dto.token_wallet_account.wallet.currency_wallet_accounts.filter(primary=True).exists():
            raise ValidationError(_("کیف نقدی برای دریافت جایزه پیدا نشد؛ با پشتیبانی تماس بگیر."))

        # Locked, checked and debited in one go: two spins at once cannot both pass the check,
        # and no other change to the account is overwritten.
        account = balance.lock(dto.token_wallet_account)
        balance.check_debit(
            account,
            dto.lottery_wheel.cost_per_spin,
            _("Cannot spin: would exceed maximum negative points limit."),
        )
        balance.add_points(account, -int(dto.lottery_wheel.cost_per_spin))

        multiplier = max(1, int(dto.multiplier or 1))
        selected_prize = self.select_prize(prizes, multiplier)
        if not selected_prize:
            return None

        # مبلغِ جایزه ×M (فقط در حافظه برای پرداخت و پاسخ؛ ردیفِ مدل save نمی‌شود)
        if selected_prize.prize_type != LotteryWheelPrize.PrizeType.EMPTY:
            selected_prize.prize_amount = selected_prize.prize_amount * multiplier

        target_account = None  # the token account a recharge prize credited (for the history)
        match selected_prize.prize_type:
            case LotteryWheelPrize.PrizeType.CASH:
                self.currency_wallet_account_transfer_service.send_prize_to_customer(
                    CurrencyWalletAccountTransferService.SendPrizeToCustomerDTO(
                        prize_amount=selected_prize.prize_amount,
                        customer=dto.customer,
                        destination_wallet_account=dto.token_wallet_account.wallet.currency_wallet_accounts.filter(
                            primary=True
                        ).first(),
                    )
                )
            case LotteryWheelPrize.PrizeType.RECHARGE:
                # جایزهٔ امتیازی: پیش‌فرض همان کیفِ امتیازیِ پرداختِ چرخش؛ اگر
                # برای جایزه target_token مشخص شده باشد، کیفِ همان توکن شارژ می‌شود.
                target_account = dto.token_wallet_account
                if selected_prize.target_token_id:
                    specified = dto.token_wallet_account.wallet.token_wallet_accounts.filter(
                        token_id=selected_prize.target_token_id
                    ).first()
                    if specified:
                        target_account = specified
                balance.add_points(target_account, selected_prize.prize_amount)
            case LotteryWheelPrize.PrizeType.EMPTY:
                # پوچ: جایزه‌ای واریز نمی‌شود
                pass
            case _:
                raise ValueError("Invalid prize type")

        # برای پوچ تراکنشِ جایزه ثبت نمی‌کنیم
        if selected_prize.prize_type != LotteryWheelPrize.PrizeType.EMPTY:
            self.transaction_service.create_prize_wheel_payment(
                self.transaction_service.CreatePrizeWheelPaymentDTO(
                    customer=dto.customer,
                    lottery_wheel=dto.lottery_wheel,
                    prize=selected_prize,
                    token_account=target_account,
                )
            )

        spin, created = LotteryWheelSpin.objects.get_or_create(
            lottery_wheel=dto.lottery_wheel,
            customer=dto.customer,
        )
        if not created:
            LotteryWheelSpin.objects.filter(pk=spin.pk).update(count=F("count") + 1)
            spin.refresh_from_db(fields=["count"])

        # لاگِ هر چرخش: ضریبِ انتخابی + چرخ + جایزه + زمانِ چرخش (create_time)
        LotteryWheelSpinLog.objects.create(
            lottery_wheel=dto.lottery_wheel,
            customer=dto.customer,
            cost=int(dto.lottery_wheel.cost_per_spin),
            multiplier=multiplier,
            prize=selected_prize if selected_prize.pk else None,
            paid_amount=selected_prize.prize_amount if selected_prize.prize_type != LotteryWheelPrize.PrizeType.EMPTY else 0,
            request_id=dto.request_id or None,
        )

        return selected_prize, spin
