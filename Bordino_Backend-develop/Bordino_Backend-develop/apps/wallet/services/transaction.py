from dataclasses import dataclass
from decimal import Decimal

from django.db import transaction
from django.utils.translation import gettext_lazy as _

from apps.lottery.models import LotteryWheel, LotteryWheelPrize, Ticket
from apps.users.models import Customer
from apps.wallet.models import Token, TokenWalletAccount
from apps.wallet.models.transactions.lottery_prize import LotteryPrizeTransaction
from apps.wallet.models.transactions.lottery_ticket import LotteryTicketTransaction
from apps.wallet.models.transactions.lottery_wheel_prize import LotteryWheelPrizeTransaction
from apps.wallet.models.transactions.referral import ReferralRewardTransaction


class TransactionService:
    @dataclass
    class CreateTicketPurchaseDTO:
        customer: Customer
        buyer_token_wallet_account: TokenWalletAccount
        ticket: Ticket
        token: Token
        amount: Decimal

    @dataclass
    class CreatePrizePaymentDTO:
        ticket: Ticket
        amount: Decimal

    @dataclass
    class CreatePrizeWheelPaymentDTO:
        customer: Customer
        lottery_wheel: LotteryWheel
        prize: LotteryWheelPrize
        token_account: object = None  # the account a recharge prize credited

    @dataclass
    class CreateReferralRewardDTO:
        referrer: Customer
        ticket: Ticket
        token: Token
        amount: Decimal
        level: int

    @transaction.atomic
    def create_ticket_purchase(self, dto: CreateTicketPurchaseDTO, status=None):
        """Create a lottery ticket purchase transaction.

        With ``status=COMPLETED`` the wallet signal deducts the points immediately
        (used by the create-with-numbers flow, where ticket creation and payment
        happen together). Defaults to PENDING for the deferred/legacy flow.
        """

        if status is None:
            status = LotteryTicketTransaction.Status.PENDING

        transaction_record = LotteryTicketTransaction.objects.create(
            customer=dto.customer,
            source_wallet=dto.buyer_token_wallet_account,
            token=dto.token,
            amount=dto.amount,
            lottery=dto.ticket.lottery,
            ticket=dto.ticket,
            description=_("Lottery ticket purchase: {}").format(dto.ticket.name),
            status=status,
        )

        return transaction_record

    @transaction.atomic
    def create_prize_payment(self, dto: CreatePrizePaymentDTO, paid=True):
        """Create lottery prize payment transaction (pending when the transfer failed)"""

        transaction_record = LotteryPrizeTransaction.objects.create(
            lottery=dto.ticket.lottery,
            ticket=dto.ticket,
            prize_amount=dto.amount,
            description=_("Lottery prize for ticket: {}").format(dto.ticket.name),
            status=(
                LotteryPrizeTransaction.Status.COMPLETED
                if paid
                else LotteryPrizeTransaction.Status.PENDING
            ),
        )

        return transaction_record

    @transaction.atomic
    def create_prize_wheel_payment(self, dto: CreatePrizeWheelPaymentDTO):
        """Create lottery prize payment transaction"""

        transaction_record = LotteryWheelPrizeTransaction.objects.create(
            lottery_wheel=dto.lottery_wheel,
            customer=dto.customer,
            prize=dto.prize,
            amount=dto.prize.prize_amount,  # already × multiplier (lottery_wheel.spin_wheel)
            token_account=dto.token_account,
            prize_type=dto.prize.prize_type,
            description=_("Lottery wheel prize: {}").format(dto.prize.name),
            status=LotteryWheelPrizeTransaction.Status.COMPLETED,
        )

        return transaction_record

    @transaction.atomic
    def create_referral_reward(self, dto: CreateReferralRewardDTO):
        """Create referral reward transaction"""

        transaction_record = ReferralRewardTransaction.objects.create(
            referrer=dto.referrer,
            buyer=dto.ticket.customer,
            token=dto.token,
            tokens_amount=dto.amount,
            level=dto.level,
            status=ReferralRewardTransaction.Status.COMPLETED,
        )

        return transaction_record
