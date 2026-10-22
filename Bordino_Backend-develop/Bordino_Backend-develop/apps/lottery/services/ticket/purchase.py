import math

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.db.models import F
from django.utils.translation import gettext_lazy as _

from apps.lottery.models import Lottery, ReferralRewardConfig, Ticket
from apps.lottery.repositories.ticket.command import TicketCommandRepository
from apps.users.models import Customer
from apps.wallet.models import TokenWalletAccount
from apps.wallet.models.transactions.lottery_ticket import LotteryTicketTransaction
from apps.wallet.services import balance
from apps.wallet.repositories.token_wallet_account.query import TokenWalletAccountQueryRepository
from apps.wallet.services.token_wallet_account.creation import TokenWalletAccountCreationService
from apps.wallet.services.transaction import TransactionService
from apps.wallet.services.utils import get_max_negative_limit, would_deduction_exceed_negative_limit


class TicketPurchaseService:
    def __init__(self):
        self.ticket_command_repository = TicketCommandRepository()
        self.token_wallet_account_query_repository = TokenWalletAccountQueryRepository()
        self.token_wallet_account_creation_service = TokenWalletAccountCreationService()
        self.transaction_service = TransactionService()

    def _get_referral_chain(self, customer, max_level=2):
        """Get the chain of inviters up to max_level"""
        referral_chain = []
        current_user = customer.user
        current_level = 1

        while current_user.customer.invited_by and current_level <= max_level:
            referral_chain.append((current_level, current_user.customer.invited_by.customer))
            current_user = current_user.customer.invited_by
            current_level += 1

        return referral_chain

    def _calculate_required_tokens(self, lottery, token_wallet_account) -> int:
        """Calculate base required tokens for ticket price"""
        return math.ceil(lottery.ticket_price / token_wallet_account.token.price)

    def _calculate_referral_reward_tokens(self, required_tokens: int, level: int) -> int:
        """Calculate reward tokens for a specific referral level"""
        try:
            config = ReferralRewardConfig.objects.get(level=level, is_active=True)
            return math.floor((required_tokens * config.token_percentage) / 100)
        except ReferralRewardConfig.DoesNotExist:
            return 0

    def _calculate_total_referral_tokens(self, required_tokens: int, referral_chain) -> int:
        """Calculate total tokens that will be given to referrers"""
        total_referral_tokens = 0
        for level, __ in referral_chain:
            reward_tokens = self._calculate_referral_reward_tokens(required_tokens, level)
            total_referral_tokens += reward_tokens
        return total_referral_tokens

    def purchase_with_numbers(self, customer: Customer, numbers, token_wallet_account_id=None):
        """Create and pay for a single ticket with the given numbers in one atomic
        step.

        The ticket is created, points are deducted (COMPLETED transaction),
        referrers are rewarded and the lottery balance is credited together, or
        nothing happens at all.
        """
        try:
            lottery = Lottery.objects.get(status=Lottery.Status.ACTIVE)
        except Lottery.MultipleObjectsReturned as e:
            raise ValidationError(
                _("Multiple active lotteries found. Please contact support.")
            ) from e
        except Lottery.DoesNotExist as e:
            raise ValidationError(_("No active lottery found.")) from e
        # "active" until the draw job runs, which can be minutes after the end time: tickets are
        # sold only between start and end.
        if not lottery.is_active:
            raise ValidationError(_("Ticket sales for this lottery are closed."))

        if token_wallet_account_id:
            try:
                token_wallet_account = TokenWalletAccount.objects.get(
                    id=token_wallet_account_id,
                    wallet__owner=customer.user,
                    token=lottery.token,
                )
            except TokenWalletAccount.DoesNotExist:
                raise ValidationError(
                    _("Token wallet account not found or does not belong to you.")
                )
        else:
            token_wallet_account = (
                self.token_wallet_account_query_repository.filter_by_customer_and_token(
                    customer, lottery.token
                ).first()
            )
            if not token_wallet_account:
                raise ValidationError(
                    _("No wallet account found for token: {}").format(lottery.token.symbol)
                )

        token = token_wallet_account.token
        amount = int(lottery.ticket_price)

        if would_deduction_exceed_negative_limit(
            token_wallet_account.amount,
            amount,
            get_max_negative_limit(token_wallet_account),
        ):
            raise ValidationError(_("Insufficient balance to complete this ticket purchase."))

        # Reject duplicate number combinations for the same customer/lottery up front
        # (the DB unique constraint is the final backstop for concurrent requests).
        if Ticket.objects.filter(
            lottery=lottery, customer=customer, numbers=numbers
        ).exists():
            raise ValidationError(_("You already have a ticket with these numbers."))

        referral_chain = self._get_referral_chain(customer)

        try:
            with transaction.atomic():
                # The check above ran on a plain read; two purchases at once could both pass it.
                # Again under the row lock, which holds until this transaction (and the debit
                # its signal makes) commits.
                token_wallet_account = balance.lock(token_wallet_account)
                balance.check_debit(
                    token_wallet_account,
                    amount,
                    _("Insufficient balance to complete this ticket purchase."),
                )
                ticket = self.ticket_command_repository.create_ticket(
                    customer=customer,
                    lottery=lottery,
                    numbers=numbers,
                    name=lottery.name,
                )

                # COMPLETED transaction -> wallet signal deducts the points now.
                self.transaction_service.create_ticket_purchase(
                    self.transaction_service.CreateTicketPurchaseDTO(
                        customer=customer,
                        buyer_token_wallet_account=token_wallet_account,
                        ticket=ticket,
                        token=token,
                        amount=lottery.ticket_price,
                    ),
                    status=LotteryTicketTransaction.Status.COMPLETED,
                )

                total_referral_tokens = self._calculate_total_referral_tokens(
                    amount, referral_chain
                )
                self._process_referral_rewards(
                    token=token,
                    required_tokens=amount,
                    referral_chain=referral_chain,
                    ticket=ticket,
                )

                lottery_tokens = amount - total_referral_tokens
                Lottery.objects.filter(id=lottery.id).update(
                    balance=F("balance") + lottery_tokens * token.price,
                    # امتیازِ کاملِ پرداختیِ خریدار (مبنای «مبلغ جایزه»)
                    tickets_points_spent=F("tickets_points_spent") + amount,
                )
        except IntegrityError as e:
            raise ValidationError(_("You already have a ticket with these numbers.")) from e

        return ticket

    def _process_referral_rewards(
        self, token, required_tokens: int, referral_chain: list, ticket: Ticket
    ):
        """Process token rewards for all eligible referrers"""

        for level, referrer in referral_chain:
            # Calculate reward tokens
            reward_tokens = self._calculate_referral_reward_tokens(required_tokens, level)

            if reward_tokens > 0:
                # Get or create referrer's wallet account for this token
                referrer_wallet = (
                    self.token_wallet_account_query_repository.filter_by_customer_and_token(
                        referrer, token
                    ).first()
                )
                if not referrer_wallet:
                    referrer_wallet = self.token_wallet_account_creation_service.create_token_wallet_account_by_system(
                        self.token_wallet_account_creation_service.CreateTokenWalletAccountDTO(
                            wallet=balance.customer_wallet(referrer.user),
                            name=f"کیف پول {token.symbol}",
                            symbol=token.symbol,
                        )
                    )

                self.transaction_service.create_referral_reward(
                    self.transaction_service.CreateReferralRewardDTO(
                        referrer=referrer,
                        ticket=ticket,
                        token=token,
                        amount=reward_tokens,
                        level=level,
                    )
                )
