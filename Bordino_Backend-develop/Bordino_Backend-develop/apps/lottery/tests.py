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

    def test_no_ticket_after_the_draw_even_inside_the_sales_window(self):
        self.end_sales()
        LotteryWinnerService(self.lottery).draw()
        Lottery.objects.filter(pk=self.lottery.pk).update(end_date=timezone.now() + timedelta(hours=1))
        with self.assertRaises(ValidationError):
            self.buy([1, 2, 3, 4, 5, 6])

    def test_a_failed_payout_keeps_the_draw_and_pays_nobody_twice(self):
        self.buy([1, 2, 3, 4, 5, 6])
        self.end_sales()
        with mock.patch(
            "apps.lottery.services.lottery.lottery_winner.draw_numbers",
            return_value=[1, 20, 21, 22, 23, 24],
        ) as drawn, mock.patch(
            "apps.wallet.services.currency_wallet_account.transfer."
            "CurrencyWalletAccountTransferService.send_prize_to_customer",
            side_effect=ValidationError("Wallet has expired"),
        ):
            LotteryWinnerService(self.lottery).process_winners()
        self.assertEqual(drawn.call_count, 1)
        self.lottery.refresh_from_db()
        self.assertEqual(
            (self.lottery.status, self.lottery.numbers), (Lottery.Status.COMPLETED, [1, 20, 21, 22, 23, 24])
        )
        from apps.wallet.models import LotteryPrizeTransaction  # pylint: disable=import-outside-toplevel

        self.assertEqual(LotteryPrizeTransaction.objects.get().status, "pending")

    def test_a_retry_after_the_draw_uses_the_same_numbers(self):
        self.end_sales()
        with mock.patch(
            "apps.lottery.services.lottery.lottery_winner.draw_numbers", return_value=[2, 3, 4, 5, 6, 7]
        ):
            LotteryWinnerService(self.lottery).draw()
        with mock.patch(
            "apps.lottery.services.lottery.lottery_winner.draw_numbers", return_value=[30, 31, 32, 33, 34, 35]
        ):
            LotteryWinnerService(self.lottery).process_winners()
        self.lottery.refresh_from_db()
        self.assertEqual(self.lottery.numbers, [2, 3, 4, 5, 6, 7])

    def test_purchase_for_a_changed_offer_is_refused(self):
        with self.assertRaises(ValidationError):
            TicketPurchaseService().purchase_with_numbers(
                self.player.customer, [1, 2, 3, 4, 5, 6], expected_price=5
            )
        with self.assertRaises(ValidationError):
            TicketPurchaseService().purchase_with_numbers(
                self.player.customer, [1, 2, 3, 4, 5, 6], lottery_id="00000000-0000-0000-0000-000000000000"
            )
        self.assertEqual(Ticket.objects.count(), 0)

    def test_the_same_numbers_in_another_order_are_the_same_ticket(self):
        self.buy([1, 2, 3, 4, 5, 6])
        with self.assertRaises(ValidationError):
            self.buy([6, 5, 4, 3, 2, 1])
        self.assertEqual(Ticket.objects.count(), 1)

    def test_referral_rewards_skip_the_buyer_and_stay_within_the_price(self):
        from apps.lottery.models import ReferralRewardConfig  # pylint: disable=import-outside-toplevel

        inviter = make_customer("9120000803", points=0)
        self.player.customer.invited_by = inviter
        self.player.customer.save(update_fields=["invited_by"])
        inviter.customer.invited_by = self.player  # a cycle made before the check existed
        inviter.customer.save(update_fields=["invited_by"])
        ReferralRewardConfig.objects.bulk_create(
            [ReferralRewardConfig(level=1, token_percentage=80), ReferralRewardConfig(level=2, token_percentage=80)]
        )
        before = balance.points_account(self.player).amount
        self.buy([1, 2, 3, 4, 5, 6])
        self.assertEqual(balance.points_account(self.player).amount, before - 10)  # no self-reward
        self.assertEqual(balance.points_account(inviter).amount, 8)

    def test_referral_percentages_cannot_exceed_100(self):
        from apps.lottery.models import ReferralRewardConfig  # pylint: disable=import-outside-toplevel

        ReferralRewardConfig.objects.create(level=1, token_percentage=70)
        with self.assertRaises(ValidationError):
            ReferralRewardConfig(level=2, token_percentage=40).full_clean()

    def test_negative_prices_and_prizes_are_refused(self):
        self.lottery.ticket_price = -10
        with self.assertRaises(ValidationError):
            self.lottery.full_clean()
        with self.assertRaises(ValidationError):
            PrizeRule(lottery=self.lottery, match_count=2, prize_amount=-50).full_clean()

    def test_only_one_lottery_can_be_active(self):
        from django.db import IntegrityError  # pylint: disable=import-outside-toplevel

        # save() validates first (ValidationError); the database constraint backs it (IntegrityError).
        with self.assertRaises((IntegrityError, ValidationError)):
            Lottery.objects.create(
                name="second", owner=self.lottery.owner, token=self.lottery.token, ticket_price=10,
                status=Lottery.Status.ACTIVE, start_date=self.lottery.start_date, end_date=self.lottery.end_date,
            )


@override_settings(CACHES=LOCMEM)
class ReferralCycleTests(TestCase):
    def test_an_invitee_cannot_become_their_inviters_inviter(self):
        a = make_customer("9120000811")
        b = make_customer("9120000812")
        b.customer.invited_by = a
        b.customer.save(update_fields=["invited_by"])
        from apps.user_management.services.user.registration import (  # pylint: disable=import-outside-toplevel
            UserRegistrationService,
        )

        with self.assertRaises(ValueError):
            UserRegistrationService()._validate_and_store_referral_code(  # pylint: disable=protected-access
                b.customer.referral_code, a
            )
        a.customer.refresh_from_db()
        self.assertIsNone(a.customer.invited_by)


@override_settings(CACHES=LOCMEM)
class Batch4cTests(TestCase):
    """Codex pass 2 on batch 4b (2026-10-22)."""

    setUp = DrawTests.setUp
    buy = DrawTests.buy
    end_sales = DrawTests.end_sales

    def test_a_negative_prize_rule_cannot_be_saved(self):
        with self.assertRaises(ValidationError):
            PrizeRule.objects.create(lottery=self.lottery, match_count=3, prize_amount=-100)

    def test_a_winner_without_a_currency_account_does_not_stop_settlement(self):
        from apps.wallet.models import CurrencyWalletAccount, LotteryPrizeTransaction  # pylint: disable=import-outside-toplevel

        self.buy([1, 2, 3, 4, 5, 6])
        CurrencyWalletAccount.objects.filter(wallet__owner=self.player).update(primary=False)
        self.end_sales()
        with mock.patch(
            "apps.lottery.services.lottery.lottery_winner.draw_numbers", return_value=[1, 20, 21, 22, 23, 24]
        ):
            LotteryWinnerService(self.lottery).process_winners()
        self.lottery.refresh_from_db()
        self.assertEqual(self.lottery.status, Lottery.Status.COMPLETED)
        self.assertEqual(LotteryPrizeTransaction.objects.get().status, "pending")

    def test_tickets_are_stored_sorted_whatever_writes_them(self):
        ticket = self.buy([6, 5, 4, 3, 2, 1])
        ticket.numbers = [9, 8, 7, 6, 5, 4]
        ticket.save()
        ticket.refresh_from_db()
        self.assertEqual(ticket.numbers, [4, 5, 6, 7, 8, 9])

    def test_a_long_referral_chain_back_to_the_user_is_refused(self):
        from apps.user_management.services.user.registration import (  # pylint: disable=import-outside-toplevel
            UserRegistrationService,
        )

        chain = [make_customer(f"91200009{i:02d}") for i in range(25)]
        for invitee, inviter in zip(chain[1:], chain[:-1]):
            invitee.customer.invited_by = inviter
            invitee.customer.save(update_fields=["invited_by"])
        # chain[0] naming the last one would close a 25-step loop.
        with self.assertRaises(ValueError):
            UserRegistrationService()._validate_and_store_referral_code(  # pylint: disable=protected-access
                chain[-1].customer.referral_code, chain[0]
            )


@override_settings(CACHES=LOCMEM)
class AuditPhase2Tests(TestCase):
    """Full Codex audit, phase 2 (2026-10-28): tickets, results privacy, wheel, chicken."""

    def setUp(self):
        from apps.lottery.models import LotteryWheel, LotteryWheelPrize  # pylint: disable=import-outside-toplevel

        self.player = make_customer("9120003001", points=1000)
        self.other = make_customer("9120003002", points=1000)
        self.sponsor = Sponsor.objects.create(user=make_customer("9120003003"))
        token = balance.points_account(self.player).token
        token.price = 1
        token.save()
        now = timezone.now()
        self.lottery = Lottery.objects.create(
            name="audit", owner=self.sponsor, token=token, ticket_price=10, status=Lottery.Status.ACTIVE,
            start_date=now - timedelta(days=1), end_date=now + timedelta(days=1),
        )
        PrizeRule.objects.create(lottery=self.lottery, match_count=1, prize_amount=100)
        self.wheel = LotteryWheel.objects.create(name="w", owner=self.sponsor, cost_per_spin=10, max_spins=100, max_spins_per_customer=10)
        self.empty = LotteryWheelPrize.objects.create(lottery_wheel=self.wheel, name="empty", prize_amount=0, probability=100, prize_type=LotteryWheelPrize.PrizeType.EMPTY)
        self.api = APIClient()
        self.api.force_authenticate(self.player)

    def test_a_ticket_needs_six_different_numbers_and_repeats_match_once(self):
        ticket = Ticket(name="t", lottery=self.lottery, customer=self.player.customer, numbers=[1, 1, 1, 1, 1, 1])
        with self.assertRaises(ValidationError):
            ticket.full_clean()
        self.lottery.numbers = [1, 2, 3, 4, 5, 6]
        self.assertEqual(LotteryWinnerService(self.lottery)._calculate_matches([1, 1, 1, 1, 1, 1]), 1)  # pylint: disable=protected-access

    def test_the_admin_cannot_add_tickets(self):
        from django.contrib.admin.sites import site  # pylint: disable=import-outside-toplevel

        self.assertFalse(site._registry[Ticket].has_add_permission(None))  # pylint: disable=protected-access

    def test_results_hide_other_players_and_winners_answers_only_for_me(self):
        for user, numbers in ((self.player, [1, 2, 3, 4, 5, 6]), (self.other, [1, 7, 8, 9, 10, 11])):
            TicketPurchaseService().purchase_with_numbers(user.customer, numbers)
        Lottery.objects.filter(pk=self.lottery.pk).update(end_date=timezone.now() - timedelta(minutes=1))
        self.lottery.refresh_from_db()
        with mock.patch("apps.lottery.services.lottery.lottery_winner.draw_numbers", return_value=[1, 20, 21, 22, 23, 24]):
            LotteryWinnerService(self.lottery).process_winners()
        body = self.api.get(f"/api/v1/lotteries/{self.lottery.pk}/results/").json()
        body = body.get("result", body)
        winners = [w for g in body["results_by_match"] for w in g["winners"]]
        mine = [w for w in winners if w["is_me"]]
        others = [w for w in winners if not w["is_me"]]
        self.assertEqual(len(mine), 1)
        self.assertTrue(mine[0]["customer_id"] and mine[0]["winning_tickets"])
        self.assertTrue(others and all(w["customer_id"] is None and w["avatar"] is None and w["winning_tickets"] == [] for w in others))
        other_id = self.other.customer.pk
        self.assertEqual(self.api.get(f"/api/v1/lotteries/{self.lottery.pk}/results/winners/{other_id}/").status_code, 404)
        self.assertEqual(self.api.get(f"/api/v1/lotteries/{self.lottery.pk}/results/winners/{self.player.customer.pk}/").status_code, 200)

    def test_a_retried_spin_is_the_same_spin(self):
        url = "/api/v1/lotteries/lottery-wheel/spin/"
        for _ in range(2):
            r = self.api.post(url, {"lottery_wheel": str(self.wheel.pk), "request_id": "spin-1"}, format="json")
            self.assertIn(r.status_code, (200, 201), r.content)
        self.assertEqual(balance.points_account(self.player).amount, 990)
        self.api.post(url, {"lottery_wheel": str(self.wheel.pk), "request_id": "spin-2"}, format="json")
        self.assertEqual(balance.points_account(self.player).amount, 980)

    def test_a_negative_wheel_prize_is_refused(self):
        from apps.lottery.models import LotteryWheelPrize  # pylint: disable=import-outside-toplevel

        LotteryWheelPrize.objects.filter(pk=self.empty.pk).update(probability=50)
        LotteryWheelPrize.objects.create(lottery_wheel=self.wheel, name="bad", prize_amount=-500, probability=50, prize_type=LotteryWheelPrize.PrizeType.CASH)
        r = self.api.post("/api/v1/lotteries/lottery-wheel/spin/", {"lottery_wheel": str(self.wheel.pk), "request_id": "s-neg"}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(balance.points_account(self.player).amount, 1000)
        with self.assertRaises(ValidationError):
            LotteryWheelPrize(lottery_wheel=self.wheel, name="x", prize_amount=-1, probability=1, prize_type="cash").full_clean()

    def test_an_admin_save_does_not_write_back_stale_pool_counters(self):
        from types import SimpleNamespace  # pylint: disable=import-outside-toplevel

        from django.contrib.admin.sites import site  # pylint: disable=import-outside-toplevel

        stale = Lottery.objects.get(pk=self.lottery.pk)  # loaded before the purchase
        TicketPurchaseService().purchase_with_numbers(self.player.customer, [5, 6, 7, 8, 9, 10])
        fresh = Lottery.objects.get(pk=self.lottery.pk)
        stale.name = "renamed"
        site._registry[Lottery].save_model(None, stale, SimpleNamespace(changed_data=["name"]), True)  # pylint: disable=protected-access
        after = Lottery.objects.get(pk=self.lottery.pk)
        self.assertEqual(after.name, "renamed")
        self.assertEqual((after.balance, after.tickets_points_spent), (fresh.balance, fresh.tickets_points_spent))
