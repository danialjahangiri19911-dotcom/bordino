import random
from dataclasses import dataclass

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils.translation import gettext_lazy as _

from apps.lottery.models import LotteryWheel, LotteryWheelPrize, LotteryWheelSpin
from apps.users.models import Customer
from apps.wallet.models import TokenWalletAccount
from apps.wallet.services.currency_wallet_account.transfer import (
    CurrencyWalletAccountTransferService,
)
from apps.wallet.services.transaction import TransactionService
from apps.wallet.services.utils import get_max_negative_limit, would_deduction_exceed_negative_limit


class LotteryWheelService:
    def __init__(self):
        self.transaction_service = TransactionService()
        self.currency_wallet_account_transfer_service = CurrencyWalletAccountTransferService()

    @dataclass
    class SpinWheelDTO:
        customer: Customer
        lottery_wheel: LotteryWheel
        token_wallet_account: TokenWalletAccount

    def _validate_prizes(self, prizes):
        """Validate that prizes have valid probabilities"""
        if not prizes.exists():
            raise ValidationError(_("Lottery wheel must have at least one prize"))

        total_probability = sum(prize.probability for prize in prizes)
        if total_probability != 100:
            raise ValidationError(_("Total probability of all prizes must equal 100"))

    def select_prize(self, prizes):
        """
        Select a prize randomly based on their probabilities.
        Returns the selected prize or None if no prizes are available.
        """
        if not prizes.exists():
            return None

        # Generate a random number between 0 and 100
        random_number = random.randint(0, 99)

        # Calculate cumulative probability and select the prize
        cumulative_probability = 0
        for prize in prizes:
            cumulative_probability += prize.probability
            if random_number < cumulative_probability:
                return prize

        # This should never happen if probabilities sum to 100
        return None

    @transaction.atomic
    def spin_wheel(self, dto: SpinWheelDTO):
        """
        Spin the lottery wheel and award the selected prize to the customer.
        Returns the awarded prize or None if no prize was awarded.
        """

        prizes = dto.lottery_wheel.lottery_wheel_prizes.all()

        self._validate_prizes(prizes)

        if would_deduction_exceed_negative_limit(
            dto.token_wallet_account.amount,
            dto.lottery_wheel.cost_per_spin,
            get_max_negative_limit(dto.token_wallet_account),
        ):
            raise ValidationError(_("Cannot spin: would exceed maximum negative points limit."))

        dto.token_wallet_account.amount -= int(dto.lottery_wheel.cost_per_spin)
        dto.token_wallet_account.save()

        selected_prize = self.select_prize(prizes)
        if not selected_prize:
            return None

        match selected_prize.prize_type:
            case LotteryWheelPrize.PrizeType.CASH:
                self.currency_wallet_account_transfer_service.send_prize_to_customer(
                    CurrencyWalletAccountTransferService.SendPrizeToCustomerDTO(
                        prize_amount=selected_prize.prize_amount,
                        customer=dto.customer,
                        destination_wallet_account=dto.customer.user.wallet.currency_wallet_accounts.filter(
                            primary=True
                        ).first(),
                    )
                )
            case LotteryWheelPrize.PrizeType.RECHARGE:
                pass
            case _:
                raise ValueError("Invalid prize type")

        self.transaction_service.create_prize_wheel_payment(
            self.transaction_service.CreatePrizeWheelPaymentDTO(
                customer=dto.customer,
                lottery_wheel=dto.lottery_wheel,
                prize=selected_prize,
            )
        )

        spin, created = LotteryWheelSpin.objects.get_or_create(
            lottery_wheel=dto.lottery_wheel,
            customer=dto.customer,
        )
        if not created:
            spin.count += 1
            spin.save()

        return selected_prize, spin
