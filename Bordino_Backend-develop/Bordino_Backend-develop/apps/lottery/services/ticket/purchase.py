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
        """Get the chain of inviters up to max_level — never the buyer, never anyone twice (two
        accounts that invited each other would otherwise reward the buyer for their own ticket)."""
        referral_chain = []
        seen = {customer.pk}
        current_user = customer.user
        current_level = 1

        while current_user.customer.invited_by and current_level <= max_level:
            inviter = current_user.customer.invited_by.customer
            if inviter.pk in seen:
                break
            seen.add(inviter.pk)
            referral_chain.append((current_level, inviter))
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

    def _referral_rewards(self, required_tokens: int, referral_chain) -> list:
        """(level, referrer, tokens) for each referrer, computed once. Together they never exceed
        what the buyer paid, whatever the configured percentages add up to."""
        rewards, budget = [], required_tokens
        for level, referrer in referral_chain:
            tokens = min(self._calculate_referral_reward_tokens(required_tokens, level), budget)
            budget -= tokens
            rewards.append((level, referrer, tokens))
        return rewards

    def _check_offer(self, lottery, lottery_id=None, expected_price=None):
        # "active" until the draw job runs, which can be minutes after the end time: tickets are
        # sold only between start and end.
        if not lottery.is_active:
            raise ValidationError(_("Ticket sales for this lottery are closed."))
        # The player picked numbers for a given lottery at a given price; if it has changed
        # meanwhile (one ended, another began), they must see the new offer first.
        if lottery_id and str(lottery.pk) != str(lottery_id):
            raise ValidationError(_("This lottery has ended; a new one has started."))
        if expected_price is not None and int(lottery.ticket_price) != int(expected_price):
            raise ValidationError(_("The ticket price has changed."))

    def purchase_with_numbers(
        self, customer: Customer, numbers, token_wallet_account_id=None, lottery_id=None,
        expected_price=None,
    ):
        """Create and pay for a single ticket with the given numbers in one atomic
        step.

        The ticket is created, points are deducted (COMPLETED transaction),
        referrers are rewarded and the lottery balance is credited together, or
        nothing happens at all.
        """
        # One order for every combination (the draw ignores order): 6,5,4,3,2,1 is 1,2,3,4,5,6.
        numbers = sorted(numbers)
        try:
            lottery = Lottery.objects.get(status=Lottery.Status.ACTIVE)
        except Lottery.MultipleObjectsReturned as e:
            raise ValidationError(
                _("Multiple active lotteries found. Please contact support.")
            ) from e
        except Lottery.DoesNotExist as e:
            raise ValidationError(_("No active lottery found.")) from e
        self._check_offer(lottery, lottery_id, expected_price)

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
                # The lottery first, as settlement does: a purchase and the draw never overlap
                # (a ticket paid for after the draw would never be settled), and purchases are
                # serialised, so referral credits to each other's accounts cannot deadlock.
                lottery = Lottery.objects.select_for_update().get(pk=lottery.pk)
                if lottery.status != Lottery.Status.ACTIVE or lottery.drawn_at:
                    raise ValidationError(_("Ticket sales for this lottery are closed."))
                self._check_offer(lottery, lottery_id, expected_price)
                # Price and token as they are now, under the lock: what is checked below is what
                # is charged and what the pool records (an admin edit meanwhile cannot split them).
                amount = int(lottery.ticket_price)
                if token_wallet_account.token_id != lottery.token_id:
                    raise ValidationError(_("This lottery has ended; a new one has started."))
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

                rewards = self._referral_rewards(amount, referral_chain)
                total_referral_tokens = sum(tokens for _level, _ref, tokens in rewards)
                self._process_referral_rewards(token=token, rewards=rewards, ticket=ticket)

                lottery_tokens = amount - total_referral_tokens
                Lottery.objects.filter(id=lottery.id).update(
                    balance=F("balance") + lottery_tokens * token.price,
                    # امتیازِ کاملِ پرداختیِ خریدار (مبنای «مبلغ جایزه»)
                    tickets_points_spent=F("tickets_points_spent") + amount,
                )
        except IntegrityError as e:
            raise ValidationError(_("You already have a ticket with these numbers.")) from e

        return ticket

    def _process_referral_rewards(self, token, rewards: list, ticket: Ticket):
        """Pay the rewards computed by `_referral_rewards` (the same amounts the pool is
        reduced by)."""

        for level, referrer, reward_tokens in rewards:
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
