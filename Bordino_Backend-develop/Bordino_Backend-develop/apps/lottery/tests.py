from datetime import timedelta
from unittest import mock

from django.core.exceptions import ValidationError
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.lottery.models import Lottery, PrizeRule, Ticket
from apps.lottery.services.lottery.draw import HIGHEST_NUMBER, draw_numbers
from apps.lottery.services.lottery.lottery_winner import LotteryWinnerService
from apps.lottery.services.ticket.purchase import TicketPurchaseService
from apps.users.models import Sponsor
from apps.wallet.services import balance
from apps.wallet.tests import LOCMEM, make_customer, rial


@override_settings(CACHES=LOCMEM)
class DrawTests(TestCase):
    """Phase 4 (2026-10-22): the server draws the numbers; a lottery is settled once."""

    def setUp(self):
        self.player = make_customer("9120000801", points=1000)
        sponsor = Sponsor.objects.create(user=make_customer("9120000802"))
        now = timezone.now()
        token = balance.points_account(self.player).token
        token.price = 1  # as in production; 0 makes the prize pool 0
        token.save()
        self.lottery = Lottery.objects.create(
            name="test",
            owner=sponsor,
            token=balance.points_account(self.player).token,
            ticket_price=10,
            status=Lottery.Status.ACTIVE,
            start_date=now - timedelta(days=1),
            end_date=now + timedelta(days=1),
        )
        PrizeRule.objects.create(lottery=self.lottery, match_count=1, prize_amount=100)

    def buy(self, numbers):
        return TicketPurchaseService().purchase_with_numbers(self.player.customer, numbers)

    def end_sales(self):
        Lottery.objects.filter(pk=self.lottery.pk).update(end_date=timezone.now() - timedelta(minutes=1))
        self.lottery.refresh_from_db()

    def test_draw_is_six_different_numbers_in_range(self):
        for _ in range(200):
            numbers = draw_numbers()
            self.assertEqual(len(set(numbers)), 6)
            self.assertTrue(all(1 <= n <= HIGHEST_NUMBER for n in numbers))

    def test_numbers_are_drawn_at_settlement_replacing_any_typed_in(self):
        Lottery.objects.filter(pk=self.lottery.pk).update(numbers=[1, 2, 3, 4, 5, 6])
        self.buy([1, 2, 3, 4, 5, 6])
        self.end_sales()
        with mock.patch(
            "apps.lottery.services.lottery.lottery_winner.draw_numbers",
            return_value=[11, 12, 13, 14, 15, 1],
        ):
            LotteryWinnerService(self.lottery).process_winners()
        self.lottery.refresh_from_db()
        self.assertEqual(self.lottery.numbers, [11, 12, 13, 14, 15, 1])
        self.assertEqual(self.lottery.status, Lottery.Status.COMPLETED)
        ticket = Ticket.objects.get()
        self.assertEqual((ticket.status, ticket.matched_numbers), (Ticket.Status.WINNER, 1))

    def test_a_lottery_is_settled_and_paid_once(self):
        self.buy([1, 2, 3, 4, 5, 6])
        self.end_sales()
        with mock.patch(
            "apps.lottery.services.lottery.lottery_winner.draw_numbers",
            return_value=[1, 20, 21, 22, 23, 24],
        ):
            LotteryWinnerService(self.lottery).process_winners()
            paid = rial(self.player)
            self.assertGreater(paid, 0)
            # The beat job and the admin action with a stale copy of the same lottery.
            stale = Lottery.objects.get(pk=self.lottery.pk)
            stale.status = Lottery.Status.ACTIVE
            with self.assertRaises(ValidationError):
                LotteryWinnerService(stale).process_winners()
        self.assertEqual(rial(self.player), paid)

    def test_no_tickets_after_the_end_time(self):
        self.end_sales()
        with self.assertRaises(ValidationError):
            self.buy([1, 2, 3, 4, 5, 6])
        self.assertEqual(Ticket.objects.count(), 0)

    def test_ticket_numbers_must_be_1_to_40(self):
        api = APIClient()
        api.force_authenticate(self.player)
        r = api.patch("/api/v1/lotteries/ticket/numbers/", {"numbers": [1, 2, 3, 4, 5, 41]}, format="json")
        self.assertEqual(r.status_code, 400, r.content)
        self.assertEqual(Ticket.objects.count(), 0)
