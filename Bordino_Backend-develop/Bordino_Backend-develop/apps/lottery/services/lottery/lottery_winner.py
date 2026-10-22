import logging
from decimal import ROUND_DOWN, Decimal

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from rest_framework.exceptions import ValidationError as DRFValidationError

from apps.lottery.models import Lottery, Ticket
from apps.lottery.services.lottery.draw import draw_numbers
from apps.wallet.services import balance
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
        """تعدادِ توپ‌های منطبق = شماره‌هایی از بلیط که در شماره‌های برنده هستند
        (مقداری، هم‌سان با نمایشِ UI — نه بر اساسِ موقعیت)."""
        winning_numbers = set(self.lottery.numbers or [])
        return len([n for n in (ticket_numbers or []) if n in winning_numbers])

    def _validate_lottery_state(self):
        """Validate lottery is ready for winner calculation"""
        if self.lottery.status != Lottery.Status.ACTIVE:
            raise ValidationError(_("Only active lotteries can be completed"))

        if self.lottery.end_date > timezone.now():
            raise ValidationError(_("Cannot process winners before lottery end date"))

        if not self.prize_rules.exists():
            raise ValidationError(_("Lottery must have prize rules defined"))

    def _floor(self, amount):
        """به‌سمتِ پایین گرد می‌کند (۰ رقمِ اعشار) — and never below 0 (a prize only pays)."""
        return max(Decimal(amount).quantize(Decimal("1"), rounding=ROUND_DOWN), Decimal("0"))

    def _compute_allocations(self):
        """جایزهٔ هر بلیط را طبقِ قوانینِ توزیع محاسبه می‌کند (بدونِ هیچ side-effect).

        - استخر P = lottery.prize_amount_in_money (۲ × امتیازِ خرج‌شده × قیمت توکن)
        - سطوحِ غیرِجک‌پات: مبلغِ ثابتِ جدول (PrizeRule)
        - جک‌پات (۶ توپ) = باقیمانده‌ی استخر، با کفِ «مجموعِ جوایزِ سایر سطوح»،
          مساوی بین بلیط‌های جک‌پات
        - اگر مجموعِ جوایز از استخر بیشتر شد، همه با ضریبِ P/مجموع کم می‌شوند

        خروجی: (allocations, expired) که allocations لیستِ (ticket, match_count, prize) است.
        """
        pool = Decimal(self.lottery.prize_amount_in_money or 0)
        jackpot_match = len(self.lottery.numbers or [])
        rule_amount = {rule.match_count: Decimal(rule.prize_amount) for rule in self.prize_rules}

        non_jackpot = []  # (ticket, match, base_amount)
        jackpot_tickets = []
        expired = []

        for ticket in self.lottery.tickets.filter(status=Ticket.Status.ACTIVE):
            matches = self._calculate_matches(ticket.numbers or [])
            if jackpot_match and matches == jackpot_match:
                jackpot_tickets.append(ticket)
            elif matches in rule_amount:
                non_jackpot.append((ticket, matches, rule_amount[matches]))
            else:
                expired.append(ticket)

        non_jackpot_total = sum((base for _, _, base in non_jackpot), Decimal("0"))

        # جک‌پات = باقیمانده‌ی استخر، ولی نه کمتر از مجموعِ سایر سطوح
        if jackpot_tickets:
            jackpot_pot = max(pool - non_jackpot_total, non_jackpot_total)
        else:
            jackpot_pot = Decimal("0")

        raw_total = non_jackpot_total + jackpot_pot
        # اگر مجموع از استخر بیشتر شد، همه با ضریب کم می‌شوند تا مجموع = استخر
        coefficient = (
            pool / raw_total if raw_total > pool and raw_total > 0 else Decimal("1")
        )

        allocations = [
            (ticket, match, self._floor(base * coefficient))
            for ticket, match, base in non_jackpot
        ]

        if jackpot_tickets:
            per_ticket = (jackpot_pot / len(jackpot_tickets)) * coefficient
            for ticket in jackpot_tickets:
                allocations.append((ticket, jackpot_match, self._floor(per_ticket)))

        return allocations, expired

    def process_winners(self):
        """Draw the winning numbers (once), then pay the winners (once).

        Two transactions on purpose: the draw is committed before any payout, so a payout that
        fails rolls back only the settlement, and the retry pays the same winners — it never
        draws again (which would favour the draws whose winners happen to be payable).
        """
        self.draw()
        return self._settle()

    def draw(self):
        """Fix the winning numbers: drawn by the server, after sales closed, under the lottery
        row lock (purchases take the same lock, so none can slip in after the draw)."""
        with transaction.atomic():
            self.lottery = Lottery.objects.select_for_update().get(pk=self.lottery.pk)
            self._validate_lottery_state()
            if not self.lottery.drawn_at:
                self.lottery.numbers = draw_numbers()
                self.lottery.drawn_at = timezone.now()
                # update(), not save(): save() runs full_clean, which refuses an active lottery
                # whose end date has passed — the very state a lottery is in when it is drawn.
                Lottery.objects.filter(pk=self.lottery.pk).update(
                    numbers=self.lottery.numbers, drawn_at=self.lottery.drawn_at
                )

    @transaction.atomic
    def _settle(self):
        # Locked and re-checked: the beat job and the admin action can run at the same moment;
        # only the first settles, the second sees it completed and stops.
        self.lottery = Lottery.objects.select_for_update().get(pk=self.lottery.pk)
        self._validate_lottery_state()
        if not self.lottery.drawn_at:
            raise ValidationError(_("The lottery has not been drawn yet."))

        allocations, expired = self._compute_allocations()

        # بلیط‌های بدونِ جایزه منقضی می‌شوند
        for ticket in expired:
            ticket.status = Ticket.Status.EXPIRED
            ticket.save()

        results = {
            "total_winners": 0,
            "winners_by_category": {},
            "total_prize_amount": Decimal("0"),
        }

        for ticket, match_count, prize in allocations:
            ticket.matched_numbers = match_count
            ticket.prize_amount = prize
            ticket.status = Ticket.Status.WINNER
            ticket.save()

            # واریزِ جایزه به کیفِ نقدیِ اصلیِ برنده + ثبتِ تراکنش. One winner whose prize
            # cannot be paid (expired or missing wallet) does not stop the others: their prize
            # is recorded as pending, for the team to pay by hand.
            paid = True
            if prize > 0:
                try:
                    with transaction.atomic():
                        self.prize_transfer_service.send_prize_to_customer(
                            dto=CurrencyWalletAccountTransferService.SendPrizeToCustomerDTO(
                                prize_amount=prize,
                                customer=ticket.customer,
                                destination_wallet_account=balance.currency_account(
                                    ticket.customer.user
                                ),
                            )
                        )
                except (ValidationError, DRFValidationError) as exc:
                    paid = False
                    logging.error("Lottery prize for ticket %s not paid: %s", ticket.pk, exc)
            self.transaction_service.create_prize_payment(
                self.transaction_service.CreatePrizePaymentDTO(ticket=ticket, amount=prize),
                paid=paid,
            )

            category = results["winners_by_category"].setdefault(
                match_count, {"count": 0, "total_prize": Decimal("0")}
            )
            category["count"] += 1
            category["total_prize"] += prize
            results["total_winners"] += 1
            results["total_prize_amount"] += prize

        self.lottery.status = Lottery.Status.COMPLETED
        self.lottery.save()

        return results
