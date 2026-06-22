from decimal import ROUND_DOWN, Decimal

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from apps.lottery.models import Lottery, Ticket
from apps.wallet.services.currency_wallet_account.transfer import (
    CurrencyWalletAccountTransferService,
)
from apps.wallet.services.transaction import TransactionService


class LotteryWinnerService:
    def __init__(self, lottery):
        self.lottery = lottery
        self.prize_rules = self.lottery.prize_rules.all()
        self.transaction_service = TransactionService()
        self.prize_transfer_service = CurrencyWalletAccountTransferService()

    def _calculate_matches(self, ticket_numbers):
        """Calculate how many numbers match with lottery numbers in the same position"""
        lottery_numbers = self.lottery.numbers
        matches = 0
        for i, lottery_number in enumerate(lottery_numbers):
            if lottery_number == ticket_numbers[i]:
                matches += 1
        return matches

    def _validate_lottery_state(self):
        """Validate lottery is ready for winner calculation"""
        if self.lottery.status != Lottery.Status.ACTIVE:
            raise ValidationError(_("Only active lotteries can be completed"))

        if self.lottery.end_date > timezone.now():
            raise ValidationError(_("Cannot process winners before lottery end date"))

        if not self.prize_rules.exists():
            raise ValidationError(_("Lottery must have prize rules defined"))

    def _calculate_maximum_possible_prize(self):
        """Calculate maximum possible prize if all tickets win maximum prize"""
        total_tickets = self.lottery.total_tickets
        max_prize_rule = self.prize_rules.order_by("-prize_amount").first()
        return max_prize_rule.prize_amount * total_tickets if max_prize_rule else 0

    def _get_winners_by_match_count(self):
        """Group tickets by number of matching numbers"""
        winners = {}
        tickets = self.lottery.tickets.filter(status=Ticket.Status.ACTIVE)

        for ticket in tickets:
            matches = self._calculate_matches(ticket.numbers)
            # Only include tickets that match a prize rule
            if self.prize_rules.filter(lottery=self.lottery, match_count=matches).exists():
                if matches not in winners:
                    winners[matches] = []
                winners[matches].append(ticket)
            else:
                ticket.status = Ticket.Status.EXPIRED
                ticket.save()
        return winners

    def _calculate_total_potential_prizes(self, winners_by_matches):
        """Calculate total potential prizes based on winners and prize rules"""
        total_potential = Decimal("0")

        for prize_rule in self.prize_rules:
            match_count = prize_rule.match_count
            if match_count in winners_by_matches:
                winners_count = len(winners_by_matches[match_count])
                total_potential += prize_rule.prize_amount * winners_count

        return total_potential

    def _calculate_prize_coefficient(self, total_potential_prizes):
        """Calculate coefficient to adjust prizes if total exceeds balance"""
        if total_potential_prizes > self.lottery.balance:
            return Decimal(self.lottery.balance) / Decimal(total_potential_prizes)
        return Decimal("1")

    def _adjust_prize_amount(self, original_amount, coefficient):
        """Adjust prize amount using coefficient"""
        adjusted = original_amount * coefficient
        # Round to 0 decimal places
        return Decimal(adjusted).quantize(Decimal("1"), rounding=ROUND_DOWN)

    @transaction.atomic
    def process_winners(self):
        """Process all winners for the lottery"""
        self._validate_lottery_state()

        # Get winners grouped by match count
        winners_by_matches = self._get_winners_by_match_count()

        # Calculate total potential prizes and coefficient
        total_potential_prizes = self._calculate_total_potential_prizes(winners_by_matches)
        coefficient = self._calculate_prize_coefficient(total_potential_prizes)

        results = {
            "total_winners": 0,
            "winners_by_category": {},
            "total_prize_amount": Decimal("0"),
            "prize_coefficient": coefficient,
            "original_total_potential": total_potential_prizes,
            "adjusted_total": total_potential_prizes * coefficient,
        }

        # Process each prize rule with adjusted amounts
        for prize_rule in self.prize_rules:
            match_count = prize_rule.match_count
            if match_count in winners_by_matches:
                winning_tickets = winners_by_matches[match_count]
                adjusted_prize = self._adjust_prize_amount(prize_rule.prize_amount, coefficient)

                # Update each winning ticket
                for ticket in winning_tickets:
                    ticket.matched_numbers = match_count
                    ticket.prize_amount = adjusted_prize
                    ticket.status = Ticket.Status.WINNER
                    ticket.save()

                    # Send prize to customer
                    self.prize_transfer_service.send_prize_to_customer(
                        dto=CurrencyWalletAccountTransferService.SendPrizeToCustomerDTO(
                            prize_amount=adjusted_prize,
                            customer=ticket.customer,
                            destination_wallet_account=ticket.customer.user.wallet.currency_wallet_accounts.filter(
                                primary=True
                            ).first(),
                        )
                    )

                    self.transaction_service.create_prize_payment(
                        self.transaction_service.CreatePrizePaymentDTO(
                            ticket=ticket, amount=adjusted_prize
                        )
                    )

                # Update results
                results["winners_by_category"][match_count] = {
                    "count": len(winning_tickets),
                    "original_prize": prize_rule.prize_amount,
                    "adjusted_prize": adjusted_prize,
                    "total_prize": adjusted_prize * len(winning_tickets),
                }
                results["total_winners"] += len(winning_tickets)
                results["total_prize_amount"] += adjusted_prize * len(winning_tickets)

        # Update lottery balance and status
        self.lottery.balance -= results["total_prize_amount"]
        self.lottery.status = Lottery.Status.COMPLETED
        self.lottery.save()

        return results
