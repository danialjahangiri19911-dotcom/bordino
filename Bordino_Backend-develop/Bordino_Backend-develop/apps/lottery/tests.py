from datetime import timedelta
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.cache import cache
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
        # (these tests check the cash-wallet payouts and set their own game prices: the coin defaults
        # of 2026-11-12 — cash prizes as coins, the seeded entry fees — are switched off here)
        from apps.configuration.models import GameConfiguration as _GC, SystemConfiguration as _SC  # pylint: disable=import-outside-toplevel

        _SC.objects.update_or_create(key="CASH_PRIZES_AS_COINS", defaults={"value": "false"})
        _GC.objects.all().delete()
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

    def spin_with(self, prize, **body):
        from apps.lottery.services.lottery.lottery_wheel import LotteryWheelService  # pylint: disable=import-outside-toplevel

        prize = type(prize).objects.get(pk=prize.pk)  # as a real spin gets it: fresh from the database
        with mock.patch.object(LotteryWheelService, "select_prize", return_value=prize):
            return self.api.post("/api/v1/lotteries/lottery-wheel/spin/", {"lottery_wheel": str(self.wheel.pk), **body}, format="json")

    def test_the_bet_is_charged_and_scales_the_prize(self):
        from apps.lottery.models import LotteryWheelPrize, LotteryWheelSpinLog  # pylint: disable=import-outside-toplevel

        LotteryWheelPrize.objects.filter(pk=self.empty.pk).update(probability=50)
        twenty = LotteryWheelPrize.objects.create(lottery_wheel=self.wheel, name="20", prize_amount=20, probability=50, prize_type=LotteryWheelPrize.PrizeType.RECHARGE)
        r = self.spin_with(twenty, bet=50, request_id="b-1")  # cost 10 → bet 50 = ×5
        self.assertIn(r.status_code, (200, 201), r.content)
        self.assertEqual(r.json()["result"]["prize"]["prize_amount"], "100")
        self.assertEqual(balance.points_account(self.player).amount, 1000 - 50 + 100)
        log = LotteryWheelSpinLog.objects.get(request_id="b-1")
        self.assertEqual((log.cost, log.paid_amount), (50, 100))
        # 15 = ×1.5: 20 → 30; 25 = ×2.5 of 5 → 12 (rounded down)
        self.spin_with(twenty, bet=15, request_id="b-2")
        self.assertEqual(LotteryWheelSpinLog.objects.get(request_id="b-2").paid_amount, 30)
        five = LotteryWheelPrize.objects.create(lottery_wheel=self.wheel, name="5", prize_amount=5, probability=0, prize_type=LotteryWheelPrize.PrizeType.RECHARGE)
        self.spin_with(five, bet=25, request_id="b-3")
        self.assertEqual(LotteryWheelSpinLog.objects.get(request_id="b-3").paid_amount, 12)

    def test_a_bet_outside_the_range_is_refused_and_nothing_is_charged(self):
        for bet in (9, 501, 0):
            r = self.api.post("/api/v1/lotteries/lottery-wheel/spin/", {"lottery_wheel": str(self.wheel.pk), "bet": bet, "request_id": f"x{bet}"}, format="json")
            self.assertEqual(r.status_code, 400, r.content)
        self.assertEqual(balance.points_account(self.player).amount, 1000)

    def test_a_retry_with_another_bet_is_not_the_same_spin(self):
        url = "/api/v1/lotteries/lottery-wheel/spin/"
        self.api.post(url, {"lottery_wheel": str(self.wheel.pk), "bet": 20, "request_id": "r-1"}, format="json")
        again = self.api.post(url, {"lottery_wheel": str(self.wheel.pk), "bet": 200, "request_id": "r-1"}, format="json")
        self.assertEqual(again.status_code, 400)
        self.assertEqual(balance.points_account(self.player).amount, 980)

    def test_a_spin_without_a_bet_keeps_to_the_range_too(self):
        from apps.lottery.models import LotteryWheel  # pylint: disable=import-outside-toplevel

        LotteryWheel.objects.filter(pk=self.wheel.pk).update(min_bet=50)
        r = self.api.post("/api/v1/lotteries/lottery-wheel/spin/", {"lottery_wheel": str(self.wheel.pk), "request_id": "nobet"}, format="json")
        self.assertEqual(r.status_code, 400, r.content)
        self.assertEqual(balance.points_account(self.player).amount, 1000)

    def test_a_free_wheel_spins_without_a_bet_and_refuses_one(self):
        from apps.lottery.models import LotteryWheel  # pylint: disable=import-outside-toplevel

        LotteryWheel.objects.filter(pk=self.wheel.pk).update(cost_per_spin=0)
        url = "/api/v1/lotteries/lottery-wheel/spin/"
        self.assertIn(self.api.post(url, {"lottery_wheel": str(self.wheel.pk), "request_id": "free"}, format="json").status_code, (200, 201))
        self.assertEqual(self.api.post(url, {"lottery_wheel": str(self.wheel.pk), "bet": 10, "request_id": "free-bet"}, format="json").status_code, 400)
        self.assertEqual(balance.points_account(self.player).amount, 1000)

    def test_the_admin_form_has_the_bet_range(self):
        from django.contrib.admin.sites import site  # pylint: disable=import-outside-toplevel
        from apps.lottery.models import LotteryWheel  # pylint: disable=import-outside-toplevel

        fields = [f for _, opts in site._registry[LotteryWheel].fieldsets for f in opts["fields"]]  # pylint: disable=protected-access
        self.assertIn("min_bet", fields)
        self.assertIn("max_bet", fields)

    def test_ticket_purchases_cannot_be_changed_or_deleted_in_the_admin(self):
        from django.contrib.admin.sites import site  # pylint: disable=import-outside-toplevel

        from apps.wallet.models.transactions.lottery_ticket import LotteryTicketTransaction  # pylint: disable=import-outside-toplevel

        admin = site._registry[LotteryTicketTransaction]  # pylint: disable=protected-access
        self.assertFalse(admin.has_change_permission(None))
        self.assertFalse(admin.has_delete_permission(None))
        self.assertFalse(admin.has_add_permission(None))

    def test_admin_import_is_off_for_money_and_on_only_for_reference_data(self):
        from django.contrib.admin.sites import site  # pylint: disable=import-outside-toplevel
        from django.test import RequestFactory  # pylint: disable=import-outside-toplevel

        from apps.lottery.models import LotteryWheel  # pylint: disable=import-outside-toplevel
        from apps.wallet.models import Bank, TokenWalletAccount  # pylint: disable=import-outside-toplevel
        from apps.wallet.models.transactions.lottery_ticket import LotteryTicketTransaction  # pylint: disable=import-outside-toplevel

        request = RequestFactory().get("/admin/")
        request.user = get_user_model().objects.create_superuser(phone_number="9120003099", password="x-Pass-123")
        for model in (LotteryTicketTransaction, TokenWalletAccount, LotteryWheel):
            self.assertFalse(site._registry[model].has_import_permission(request), model)  # pylint: disable=protected-access
        self.assertTrue(site._registry[Bank].has_import_permission(request))  # pylint: disable=protected-access

    def test_every_ledger_record_is_read_only_in_the_admin(self):
        from django.contrib.admin.sites import site  # pylint: disable=import-outside-toplevel

        from apps.wallet.models import TokenTransaction  # pylint: disable=import-outside-toplevel
        from apps.wallet.models.transactions.activity import ActivityTransaction  # pylint: disable=import-outside-toplevel

        names = {"LotteryPrizeTransaction", "LotteryWheelPrizeTransaction", "ReferralRewardTransaction", "LotteryTicketTransaction"}
        models = [m for m in site._registry if m.__name__ in names] + [TokenTransaction, ActivityTransaction]  # pylint: disable=protected-access
        self.assertEqual(len(models), 6)
        for model in models:
            admin = site._registry[model]  # pylint: disable=protected-access
            self.assertFalse(admin.has_change_permission(None) or admin.has_add_permission(None) or admin.has_delete_permission(None), model)

    def test_the_wheel_tells_its_bet_range(self):
        body = self.api.get(f"/api/v1/lotteries/lottery-wheel/{self.wheel.pk}/").json()
        body = body.get("result", body)
        self.assertEqual((body["min_bet"], body["max_bet"]), (10, 500))

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


@override_settings(CACHES=LOCMEM)
class AccountingReviewTests(TestCase):
    """Codex accounting review, 2026-11-02: each case below once moved money it should not have."""

    def setUp(self):
        # (these tests check the cash-wallet payouts and set their own game prices: the coin defaults
        # of 2026-11-12 — cash prizes as coins, the seeded entry fees — are switched off here)
        from apps.configuration.models import GameConfiguration as _GC, SystemConfiguration as _SC  # pylint: disable=import-outside-toplevel

        _SC.objects.update_or_create(key="CASH_PRIZES_AS_COINS", defaults={"value": "false"})
        _GC.objects.all().delete()
        from apps.lottery.models import LotteryWheel, LotteryWheelPrize  # pylint: disable=import-outside-toplevel

        self.player = make_customer("9120004001", points=1000)
        self.sponsor = Sponsor.objects.create(user=make_customer("9120004002"))
        self.wheel = LotteryWheel.objects.create(name="w", owner=self.sponsor, cost_per_spin=10, max_spins=100, max_spins_per_customer=10)
        self.empty = LotteryWheelPrize.objects.create(lottery_wheel=self.wheel, name="empty", prize_amount=0, probability=50, prize_type=LotteryWheelPrize.PrizeType.EMPTY)
        self.api = APIClient()
        self.api.force_authenticate(self.player)
        self.url = "/api/v1/lotteries/lottery-wheel/spin/"

    def spin(self, **body):
        return self.api.post(self.url, {"lottery_wheel": str(self.wheel.pk), **body}, format="json")

    def test_a_prize_of_another_token_is_never_paid_as_points(self):
        from apps.lottery.models import LotteryWheelPrize  # pylint: disable=import-outside-toplevel
        from apps.wallet.models import Token  # pylint: disable=import-outside-toplevel

        bonus = Token.objects.create(name="bonus", symbol="BONUS", price=1)
        LotteryWheelPrize.objects.create(lottery_wheel=self.wheel, name="b", prize_amount=100, probability=50, prize_type=LotteryWheelPrize.PrizeType.RECHARGE, target_token=bonus)
        r = self.spin(request_id="t-1")
        self.assertEqual(r.status_code, 400, r.content)
        self.assertEqual(balance.points_account(self.player).amount, 1000)

    def test_a_negative_cost_is_refused_and_never_pays_a_debit(self):
        from apps.lottery.models import LotteryWheel  # pylint: disable=import-outside-toplevel

        self.wheel.cost_per_spin = -10
        with self.assertRaises(ValidationError):
            self.wheel.full_clean()
        LotteryWheel.objects.filter(pk=self.wheel.pk).update(cost_per_spin=-10)  # an old row
        self.assertEqual(self.spin(bet=10, request_id="n-1").status_code, 400)
        self.assertEqual(balance.points_account(self.player).amount, 1000)

    def test_a_spin_and_a_game_charge_need_their_request_id(self):
        self.assertEqual(self.spin().status_code, 400)
        self.assertEqual(self.api.post("/api/v1/wallet/games/charge/", {"game_name": "sudoku"}, format="json").status_code, 400)
        self.assertEqual(balance.points_account(self.player).amount, 1000)

    def test_a_retry_is_answered_after_the_wheel_is_switched_off(self):
        from apps.lottery.models import LotteryWheel  # pylint: disable=import-outside-toplevel

        from apps.lottery.models import LotteryWheelPrize  # pylint: disable=import-outside-toplevel

        LotteryWheelPrize.objects.filter(pk=self.empty.pk).update(probability=100)
        first = self.spin(request_id="r-1")
        self.assertIn(first.status_code, (200, 201), first.content)
        LotteryWheel.objects.filter(pk=self.wheel.pk).update(status=LotteryWheel.Status.INACTIVE)
        again = self.spin(request_id="r-1")
        self.assertIn(again.status_code, (200, 201), again.content)
        self.assertEqual(balance.points_account(self.player).amount, 990)
        self.assertEqual(self.spin(request_id="r-2").status_code, 400)  # a new spin is refused

    def test_money_records_and_holders_are_protected_in_the_admin(self):
        from django.contrib.admin.sites import site  # pylint: disable=import-outside-toplevel

        from apps.lottery.models import Lottery as L, LotteryWheelSpin  # pylint: disable=import-outside-toplevel
        from apps.wallet.models import BankAccount, CurrencyTransaction, CurrencyWalletAccount, TokenWalletAccount, Wallet  # pylint: disable=import-outside-toplevel

        registry = site._registry  # pylint: disable=protected-access
        for model in (Wallet, TokenWalletAccount, CurrencyWalletAccount, BankAccount, CurrencyTransaction, Ticket, LotteryWheelSpin):
            self.assertFalse(registry[model].has_delete_permission(None), model)
        self.assertFalse(registry[Ticket].has_change_permission(None))
        self.assertFalse(registry[LotteryWheelSpin].has_change_permission(None))
        account = balance.points_account(self.player)
        self.assertTrue({"wallet", "token"} <= set(registry[TokenWalletAccount].get_readonly_fields(None, account)))
        self.assertTrue({"owner"} <= set(registry[Wallet].get_readonly_fields(None, account.wallet)))
        token = account.token
        lottery = L.objects.create(name="l", owner=self.sponsor, token=token, ticket_price=10, status=L.Status.ACTIVE,
                                   start_date=timezone.now() - timedelta(days=1), end_date=timezone.now() + timedelta(days=1))
        self.assertNotIn("status", registry[L].get_readonly_fields(None, lottery))
        TicketPurchaseService().purchase_with_numbers(self.player.customer, [1, 2, 3, 4, 5, 6])
        self.assertIn("status", registry[L].get_readonly_fields(None, L.objects.get(pk=lottery.pk)))

    def test_a_pending_lottery_prize_is_paid_once_when_the_wallet_works(self):
        from apps.lottery.services.lottery.lottery_winner import pay_pending_prize  # pylint: disable=import-outside-toplevel
        from apps.wallet.models import CurrencyWalletAccount  # pylint: disable=import-outside-toplevel
        from apps.wallet.models.transactions.lottery_prize import LotteryPrizeTransaction  # pylint: disable=import-outside-toplevel

        token = balance.points_account(self.player).token
        token.price = 1
        token.save()
        lottery = Lottery.objects.create(name="p", owner=self.sponsor, token=token, ticket_price=10, status=Lottery.Status.ACTIVE,
                                         start_date=timezone.now() - timedelta(days=1), end_date=timezone.now() + timedelta(days=1))
        TicketPurchaseService().purchase_with_numbers(self.player.customer, [1, 2, 3, 4, 5, 6])
        ticket = Ticket.objects.get(lottery=lottery, customer=self.player.customer)
        tx = LotteryPrizeTransaction.objects.create(lottery=lottery, ticket=ticket, prize_amount=500, status=LotteryPrizeTransaction.Status.PENDING)
        before = CurrencyWalletAccount.objects.get(wallet__owner=self.player).balance
        self.assertTrue(pay_pending_prize(tx.pk))
        self.assertFalse(pay_pending_prize(tx.pk))  # never twice
        self.assertEqual(CurrencyWalletAccount.objects.get(wallet__owner=self.player).balance, before + 500)


@override_settings(CACHES=LOCMEM)
class LedgerCorrectnessTests(TestCase):
    def setUp(self):
        self.player = make_customer("9120004101", points=1000, rial=1000)
        self.api = APIClient()
        self.api.force_authenticate(self.player)

    def test_sudoku_charges_the_chosen_difficultys_price(self):
        from apps.configuration.models import GameConfiguration  # pylint: disable=import-outside-toplevel
        from apps.wallet.services.game_play.charge import GamePlayChargeService  # pylint: disable=import-outside-toplevel

        GameConfiguration.objects.create(game_name="sudoku", difficulty_level="easy", play_cost=5, is_active=True)
        GameConfiguration.objects.create(game_name="sudoku", difficulty_level="hard", play_cost=50, is_active=True)
        self.assertEqual(GamePlayChargeService.price("sudoku", "easy"), 5)
        self.assertEqual(GamePlayChargeService.price("sudoku", "hard"), 50)
        with self.assertRaises(ValidationError):
            GamePlayChargeService.price("sudoku", "medium")

    def test_an_app_reported_event_never_pays(self):
        from apps.configuration.models import GameConfiguration, ScoreConfiguration  # pylint: disable=import-outside-toplevel
        from apps.wallet.models import GamePlayCharge  # pylint: disable=import-outside-toplevel

        GameConfiguration.objects.create(game_name="sudoku", difficulty_level="easy", play_cost=0, is_active=True)
        ScoreConfiguration.objects.create(section="sudoku", action_type="hint_used", score_value=40, is_active=True)
        GamePlayCharge.objects.create(customer=self.player.customer, token_account=balance.points_account(self.player), game_name="sudoku", cost=0)
        r = self.api.post("/api/v1/activity/record-action/", {"section": "sudoku", "action_type": "hint_used"}, format="json")
        self.assertIn(r.status_code, (200, 201), r.content)
        self.assertEqual(balance.points_account(self.player).amount, 1000)

    def test_adjustments_are_recorded_and_listed_taken_away_too(self):
        from apps.wallet.services.adjust import adjust_points  # pylint: disable=import-outside-toplevel
        from apps.wallet.services.history import points_history  # pylint: disable=import-outside-toplevel

        adjust_points(balance.points_account(self.player), -100)
        rows = [r for r in points_history(self.player) if r["type"] == "activity_reward"]
        self.assertEqual([(r["amount"], r["is_positive"]) for r in rows], [(100, False)])
        self.assertEqual(balance.points_account(self.player).amount, 900)

    def test_a_withdrawal_needs_the_money_to_be_there(self):
        from apps.configuration.models import SystemConfiguration  # pylint: disable=import-outside-toplevel
        from apps.wallet.models import Bank, BankAccount  # pylint: disable=import-outside-toplevel

        SystemConfiguration.objects.update_or_create(key="WALLET_MAX_NEGATIVE_CURRENCY", defaults={"value": "100000", "value_type": "int"})
        bank, _ = Bank.objects.get_or_create(code="012", defaults={"name": "b"})
        account = BankAccount.objects.create(user=self.player, bank=bank, iban="IR062960000000100324200001", account_holder="t", status=BankAccount.Status.APPROVED)
        r = self.api.post("/api/v1/wallet/currency/withdraw/", {"amount": 5000, "bank_account_id": str(account.pk), "request_id": "w-1"}, format="json")
        self.assertEqual(r.status_code, 400, r.content)


@override_settings(CACHES=LOCMEM)
class AccountingFollowUpTests(TestCase):
    """Codex's check of the accounting fixes, 2026-11-02: each case below still moved money wrongly."""

    def setUp(self):
        # (these tests check the cash-wallet payouts and set their own game prices: the coin defaults
        # of 2026-11-12 — cash prizes as coins, the seeded entry fees — are switched off here)
        from apps.configuration.models import GameConfiguration as _GC, SystemConfiguration as _SC  # pylint: disable=import-outside-toplevel

        _SC.objects.update_or_create(key="CASH_PRIZES_AS_COINS", defaults={"value": "false"})
        _GC.objects.all().delete()
        from apps.lottery.models import LotteryWheel, LotteryWheelPrize  # pylint: disable=import-outside-toplevel

        self.player = make_customer("9120004201", points=1000)
        self.sponsor = Sponsor.objects.create(user=make_customer("9120004202"))
        self.wheel = LotteryWheel.objects.create(name="w", owner=self.sponsor, cost_per_spin=10, max_spins=100, max_spins_per_customer=10)
        self.empty = LotteryWheelPrize.objects.create(lottery_wheel=self.wheel, name="empty", prize_amount=0, probability=100, prize_type=LotteryWheelPrize.PrizeType.EMPTY)
        self.api = APIClient()
        self.api.force_authenticate(self.player)

    def points(self):
        return balance.points_account(self.player).amount

    def spin(self, **body):
        return self.api.post("/api/v1/lotteries/lottery-wheel/spin/", {"lottery_wheel": str(self.wheel.pk), **body}, format="json")

    def sudoku_levels(self):
        from apps.configuration.models import GameConfiguration  # pylint: disable=import-outside-toplevel

        GameConfiguration.objects.create(game_name="sudoku", difficulty_level="easy", play_cost=5, is_active=True)
        GameConfiguration.objects.create(game_name="sudoku", difficulty_level="hard", play_cost=50, is_active=True)

    def test_a_cheap_charge_never_starts_a_dearer_sudoku(self):
        from apps.crash.services import sudoku  # pylint: disable=import-outside-toplevel

        self.sudoku_levels()
        r = self.api.post("/api/v1/wallet/games/charge/", {"game_name": "sudoku", "request_id": "s-1"}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        paid = r.json()["result"]["cost"]  # the game's general price (no level named)
        start = lambda rid: self.api.post("/api/v1/games/sudoku/rounds/", {"difficulty": "hard", "request_id": rid}, format="json")  # noqa: E731
        with mock.patch.object(sudoku, "check_unlocked"):
            self.assertEqual(start("s-1").status_code, 400)
            # A continuation paid at this very level does not buy a new board either.
            r = self.api.post("/api/v1/wallet/games/charge/", {"game_name": "sudoku", "request_id": "s-3", "difficulty": "hard"}, format="json")
            self.assertEqual(r.json()["result"]["cost"], 50, r.content)
            self.assertEqual(start("s-3").status_code, 400)
            # The same id at another level's price is not the same charge either.
            r = self.api.post("/api/v1/wallet/games/charge/", {"game_name": "sudoku", "request_id": "s-1", "difficulty": "hard"}, format="json")
            self.assertEqual(r.status_code, 400, r.content)
            round_, _left = sudoku.start(self.player, "hard", "s-2")
        self.assertEqual(round_.difficulty, "hard")
        self.assertEqual(self.points(), 1000 - paid - 50 - 50)

    def test_the_quoted_price_is_the_levels_and_so_is_a_continuation(self):
        self.sudoku_levels()
        quote = lambda level: self.api.get(f"/api/v1/wallet/games/charge/?game_name=sudoku&difficulty_level={level}").json()["result"]["play_cost"]  # noqa: E731
        self.assertEqual((quote("easy"), quote("hard"), quote("medium")), (5, 50, None))
        r = self.api.post("/api/v1/wallet/games/charge/", {"game_name": "sudoku", "request_id": "c-1", "difficulty": "hard"}, format="json")
        self.assertEqual(r.json()["result"]["cost"], 50, r.content)
        # Its retry, after that level's price was switched off: answered as it was charged.
        from apps.configuration.models import GameConfiguration  # pylint: disable=import-outside-toplevel

        GameConfiguration.objects.filter(difficulty_level="hard").update(is_active=False)
        r = self.api.post("/api/v1/wallet/games/charge/", {"game_name": "sudoku", "request_id": "c-1", "difficulty": "hard"}, format="json")
        self.assertEqual((r.status_code, r.json()["result"]["cost"]), (200, 50), r.content)
        # A level with no price of its own is not on offer (never another level's price).
        r = self.api.post("/api/v1/wallet/games/charge/", {"game_name": "sudoku", "request_id": "c-2", "difficulty": "medium"}, format="json")
        self.assertEqual(r.status_code, 400, r.content)
        self.assertEqual(self.points(), 950)

    def test_a_prize_token_with_two_accounts_still_pays_the_win(self):
        from apps.lottery.models import LotteryWheelPrize  # pylint: disable=import-outside-toplevel
        from apps.wallet.models import Token, TokenPresetWallet, TokenWalletAccount  # pylint: disable=import-outside-toplevel

        own = balance.points_account(self.player)
        bonus = Token.objects.create(name="bonus", symbol="BONUS", price=1)
        other = next(v for v in TokenPresetWallet.ActivationBy.values if v != own.preset_wallet.activation_by)
        preset = TokenPresetWallet.objects.create(name="second", wallet_type=own.preset_wallet.wallet_type, activation_by=other, actions=["exchange"])
        first = TokenWalletAccount.objects.create(name="b1", wallet=own.wallet, preset_wallet=own.preset_wallet, token=bonus)
        TokenWalletAccount.objects.create(name="b2", wallet=own.wallet, preset_wallet=preset, token=bonus)
        LotteryWheelPrize.objects.filter(pk=self.empty.pk).update(probability=1)
        LotteryWheelPrize.objects.create(lottery_wheel=self.wheel, name="b", prize_amount=100, probability=99, prize_type=LotteryWheelPrize.PrizeType.RECHARGE, target_token=bonus)
        with mock.patch("apps.lottery.services.lottery.lottery_wheel.random.uniform", return_value=50):
            r = self.spin(request_id="b-1")
        self.assertIn(r.status_code, (200, 201), r.content)
        self.assertEqual((self.points(), TokenWalletAccount.objects.get(pk=first.pk).amount), (990, 100))

    def test_retries_repeat_the_spin_after_the_price_changes(self):
        from apps.lottery.models import LotteryWheel  # pylint: disable=import-outside-toplevel

        self.assertIn(self.spin(request_id="p-1").status_code, (200, 201))
        LotteryWheel.objects.filter(pk=self.wheel.pk).update(cost_per_spin=20)
        self.assertIn(self.spin(request_id="p-1").status_code, (200, 201))
        LotteryWheel.objects.filter(pk=self.wheel.pk).update(cost_per_spin=10)
        self.assertIn(self.spin(request_id="p-2", bet=30).status_code, (200, 201))
        LotteryWheel.objects.filter(pk=self.wheel.pk).update(cost_per_spin=0)
        self.assertIn(self.spin(request_id="p-2", bet=30).status_code, (200, 201))
        self.assertEqual(self.spin(request_id="p-2", bet=40).status_code, 400)  # another bet: not a retry
        self.assertEqual(self.points(), 1000 - 10 - 30)

    def test_a_blocked_cash_account_is_never_paid(self):
        from apps.lottery.models import LotteryWheelPrize  # pylint: disable=import-outside-toplevel
        from apps.lottery.services.lottery.lottery_winner import pay_pending_prize  # pylint: disable=import-outside-toplevel
        from apps.wallet.models import CurrencyWalletAccount  # pylint: disable=import-outside-toplevel
        from apps.wallet.models.transactions.lottery_prize import LotteryPrizeTransaction  # pylint: disable=import-outside-toplevel

        LotteryWheelPrize.objects.filter(pk=self.empty.pk).update(probability=50)
        LotteryWheelPrize.objects.create(lottery_wheel=self.wheel, name="c", prize_amount=500, probability=50, prize_type=LotteryWheelPrize.PrizeType.CASH)
        cash = CurrencyWalletAccount.objects.filter(wallet__owner=self.player)
        cash.update(status=CurrencyWalletAccount.WalletStatus.BLOCKED)
        self.assertEqual(self.spin(request_id="x-1").status_code, 400)
        self.assertEqual(self.points(), 1000)
        token = balance.points_account(self.player).token
        lottery = Lottery.objects.create(name="p", owner=self.sponsor, token=token, ticket_price=10, status=Lottery.Status.ACTIVE,
                                         start_date=timezone.now() - timedelta(days=1), end_date=timezone.now() + timedelta(days=1))
        TicketPurchaseService().purchase_with_numbers(self.player.customer, [1, 2, 3, 4, 5, 6])
        ticket = Ticket.objects.get(lottery=lottery, customer=self.player.customer)
        tx = LotteryPrizeTransaction.objects.create(lottery=lottery, ticket=ticket, prize_amount=500, status=LotteryPrizeTransaction.Status.PENDING)
        self.assertFalse(pay_pending_prize(tx.pk))
        self.assertEqual(cash.get().balance, 0)
        cash.update(status=CurrencyWalletAccount.WalletStatus.VALID)
        self.assertTrue(pay_pending_prize(tx.pk))

    def test_a_ticket_sold_while_the_admin_form_was_open_keeps_the_lottery_as_it_is(self):
        from django.contrib.admin.sites import site  # pylint: disable=import-outside-toplevel

        from apps.lottery.admin.lottery import LotteryForm  # pylint: disable=import-outside-toplevel

        token = balance.points_account(self.player).token
        lottery = Lottery.objects.create(name="a", owner=self.sponsor, token=token, ticket_price=10, status=Lottery.Status.ACTIVE,
                                         start_date=timezone.now() - timedelta(days=1), end_date=timezone.now() + timedelta(days=1))
        admin = site._registry[Lottery]  # pylint: disable=protected-access
        form = LotteryForm(instance=lottery)
        form.cleaned_data = {}
        edited = Lottery.objects.get(pk=lottery.pk)
        edited.status, edited.name = Lottery.Status.CANCELLED, "b"
        TicketPurchaseService().purchase_with_numbers(self.player.customer, [1, 2, 3, 4, 5, 6])  # meanwhile
        with mock.patch.object(type(form), "changed_data", ["status", "name"]), mock.patch.object(admin, "message_user") as told:
            admin.save_model(None, edited, form, change=True)
        lottery.refresh_from_db()
        self.assertEqual((lottery.status, lottery.name), (Lottery.Status.ACTIVE, "b"))
        told.assert_called_once()

    def test_a_resent_crash_or_chicken_bet_is_the_same_round(self):
        from apps.crash.models import ChickenRound, CrashRound  # pylint: disable=import-outside-toplevel

        crash = lambda bet: self.api.post("/api/v1/games/crash/rounds/", {"bet": bet, "request_id": "cr-1"}, format="json")  # noqa: E731
        first = crash(100)
        self.assertEqual(first.status_code, 201, first.content)
        CrashRound.objects.update(status=CrashRound.Status.LOST)  # the round is over
        again = crash(100)
        self.assertEqual(again.json()["result"]["round"]["id"], first.json()["result"]["round"]["id"])
        self.assertEqual(crash(200).status_code, 400)
        self.assertEqual(self.points(), 900)
        chicken = lambda: self.api.post("/api/v1/games/chicken/rounds/", {"bet": 100, "difficulty": "easy", "request_id": "ch-1"}, format="json")  # noqa: E731
        first = chicken()
        self.assertEqual(first.status_code, 201, first.content)
        ChickenRound.objects.update(status=ChickenRound.Status.LOST)
        self.assertEqual(chicken().json()["result"]["round"]["id"], first.json()["result"]["round"]["id"])
        self.assertEqual(self.points(), 800)
        self.assertEqual(self.api.post("/api/v1/games/chicken/rounds/", {"bet": 100, "difficulty": "easy"}, format="json").status_code, 400)


@override_settings(CACHES=LOCMEM)
class AccountingThirdCheckTests(TestCase):
    """Codex's third check, 2026-11-03."""

    def setUp(self):
        self.player = make_customer("9120004301", points=1000)
        self.api = APIClient()
        self.api.force_authenticate(self.player)

    def points(self):
        return balance.points_account(self.player).amount

    def test_a_resent_bet_is_answered_after_the_game_is_switched_off_or_its_range_changes(self):
        from apps.crash.models import ChickenConfiguration, CrashConfiguration  # pylint: disable=import-outside-toplevel

        crash = lambda: self.api.post("/api/v1/games/crash/rounds/", {"bet": 100, "request_id": "q-1"}, format="json")  # noqa: E731
        chicken = lambda: self.api.post("/api/v1/games/chicken/rounds/", {"bet": 100, "difficulty": "easy", "request_id": "q-2"}, format="json")  # noqa: E731
        first_crash, first_chicken = crash(), chicken()
        self.assertEqual((first_crash.status_code, first_chicken.status_code), (201, 201), first_chicken.content)
        CrashConfiguration.objects.update(enabled=False)
        ChickenConfiguration.objects.update(min_bet=500)
        cache.clear()
        self.assertEqual(crash().json()["result"]["round"]["id"], first_crash.json()["result"]["round"]["id"])
        self.assertEqual(chicken().json()["result"]["round"]["id"], first_chicken.json()["result"]["round"]["id"])
        self.assertEqual(self.points(), 800)

    def test_a_level_is_never_free_when_every_price_is_switched_off(self):
        from apps.configuration.models import GameConfiguration  # pylint: disable=import-outside-toplevel

        GameConfiguration.objects.create(game_name="sudoku", difficulty_level="easy", play_cost=5, is_active=False)
        r = self.api.post("/api/v1/wallet/games/charge/", {"game_name": "sudoku", "request_id": "z-1", "difficulty": "easy"}, format="json")
        self.assertEqual(r.status_code, 400, r.content)
        quote = self.api.get("/api/v1/wallet/games/charge/?game_name=sudoku&difficulty_level=easy").json()["result"]["play_cost"]
        self.assertIsNone(quote)
        self.assertEqual(self.points(), 1000)

    def test_a_setting_is_cleared_again_once_its_save_is_committed(self):
        from apps.configuration.models import SystemConfiguration  # pylint: disable=import-outside-toplevel

        with self.captureOnCommitCallbacks() as callbacks:
            SystemConfiguration.objects.create(key="TEST_COMMIT_CLEAR", value="9", value_type="int")
            cache.set(SystemConfiguration.objects._cache_key("TEST_COMMIT_CLEAR"), 5)  # a read between the save and its commit  # pylint: disable=protected-access
        self.assertEqual(SystemConfiguration.objects.get("TEST_COMMIT_CLEAR"), 5)
        for callback in callbacks:
            callback()
        self.assertEqual(SystemConfiguration.objects.get("TEST_COMMIT_CLEAR"), 9)
