from decimal import Decimal
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.lottery.models import LotteryWheel, LotteryWheelPrize
from apps.user_management.services.user.registration import UserRegistrationService
from apps.users.models import Sponsor
from apps.wallet.models import (
    Bank,
    BankAccount,
    CurrencyTransaction,
    CurrencyWalletAccount,
    TokenWalletAccount,
)
from apps.wallet.services import balance

LOCMEM = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
WITHDRAW = "/api/v1/wallet/currency/withdraw/"


def make_customer(phone, points=0, rial=0):
    user = get_user_model().objects.create_user(phone_number=phone)
    service = UserRegistrationService()
    service._create_customer_for_user(user)  # pylint: disable=protected-access
    service._create_wallet_for_user(user)  # pylint: disable=protected-access
    TokenWalletAccount.objects.filter(wallet__owner=user).update(amount=points)
    CurrencyWalletAccount.objects.filter(wallet__owner=user).update(balance=rial)
    return user


def points(user):
    return balance.points_account(user).amount


def rial(user):
    return balance.currency_account(user).balance


@override_settings(CACHES=LOCMEM)
class WithdrawTests(TestCase):
    """Codex review 2026-10-22 (phase 3): withdrawals."""

    def setUp(self):
        self.user = make_customer("9120000701", rial=100_000)
        self.api = APIClient()
        self.api.force_authenticate(self.user)
        bank = Bank.objects.create(name="Test bank", code="T1")
        self.bank_account = BankAccount.objects.create(
            user=self.user,
            iban="IR000000000000000000000000",
            bank=bank,
            account_holder="Test",
            status=BankAccount.Status.APPROVED,
        )

    def withdraw(self, amount, **extra):
        return self.api.post(
            WITHDRAW,
            {"amount": amount, "bank_account_id": str(self.bank_account.pk), **extra},
            format="json",
        )

    def test_withdrawal_reserves_the_amount(self):
        self.assertEqual(self.withdraw(80_000).status_code, 201)
        self.assertEqual(rial(self.user), 20_000)
        self.assertEqual(self.withdraw(80_000).status_code, 400)
        self.assertEqual(rial(self.user), 20_000)
        self.assertEqual(CurrencyTransaction.objects.count(), 1)

    def test_malformed_amounts_are_a_400(self):
        for amount in (None, "abc", "NaN", "1.5", 0, -5):
            self.assertEqual(self.withdraw(amount).status_code, 400, amount)
        self.assertEqual(rial(self.user), 100_000)

    def test_a_retry_with_the_same_request_id_withdraws_once(self):
        self.assertEqual(self.withdraw(30_000, request_id="abc-1").status_code, 201)
        self.assertEqual(self.withdraw(30_000, request_id="abc-1").status_code, 201)
        self.assertEqual(rial(self.user), 70_000)
        self.assertEqual(CurrencyTransaction.objects.count(), 1)

    def test_an_inactive_account_cannot_withdraw(self):
        CurrencyWalletAccount.objects.filter(wallet__owner=self.user).update(status="blocked")
        self.assertEqual(self.withdraw(10_000).status_code, 400)
        self.assertEqual(rial(self.user), 100_000)

    def test_failed_or_cancelled_withdrawal_gives_the_money_back_once(self):
        for final in (CurrencyTransaction.Status.FAILED, CurrencyTransaction.Status.CANCELLED):
            self.withdraw(40_000)
            tx = CurrencyTransaction.objects.latest("create_time")
            tx.status = final
            tx.save()
            tx.save()  # saved again: no second refund
            self.assertEqual(rial(self.user), 100_000, final)

    def test_a_finished_withdrawal_cannot_change_status(self):
        self.withdraw(40_000)
        tx = CurrencyTransaction.objects.get()
        tx.status = CurrencyTransaction.Status.COMPLETED
        tx.save()
        tx.status = CurrencyTransaction.Status.FAILED
        with self.assertRaises(ValidationError):
            tx.full_clean()

    def test_deleting_a_stale_copy_after_a_refund_refunds_nothing_more(self):
        self.withdraw(40_000)
        stale = CurrencyTransaction.objects.get()
        fresh = CurrencyTransaction.objects.get()
        fresh.status = CurrencyTransaction.Status.FAILED
        fresh.save()
        stale.delete()  # still says "pending" in memory
        self.assertEqual(rial(self.user), 100_000)

    def test_an_edited_amount_is_not_what_gets_refunded(self):
        self.withdraw(40_000)
        tx = CurrencyTransaction.objects.get()
        tx.amount = 90_000
        tx.status = CurrencyTransaction.Status.FAILED
        with self.assertRaises(ValidationError):  # the edit itself is refused
            tx.save()
        # Even bypassing validation, the refund is the stored reservation, not the edit.
        CurrencyTransaction.objects.filter(pk=tx.pk).update(status="pending")
        tx = CurrencyTransaction.objects.get()
        tx.status = CurrencyTransaction.Status.FAILED
        tx.amount = 90_000
        with mock.patch.object(CurrencyTransaction, "full_clean"):
            tx.save()
        self.assertEqual(rial(self.user), 100_000)
        tx.refresh_from_db()
        self.assertEqual(tx.amount, 40_000)

    def test_the_same_request_id_with_other_details_is_a_conflict(self):
        self.assertEqual(self.withdraw(30_000, request_id="r-1").status_code, 201)
        self.assertEqual(self.withdraw(50_000, request_id="r-1").status_code, 409)
        self.assertEqual(rial(self.user), 70_000)

    def test_a_stale_admin_copy_cannot_finish_a_refunded_withdrawal(self):
        self.withdraw(40_000)
        first = CurrencyTransaction.objects.get()
        second = CurrencyTransaction.objects.get()
        first.status = CurrencyTransaction.Status.FAILED
        first.save()  # refunded
        second.status = CurrencyTransaction.Status.COMPLETED
        with self.assertRaises(ValidationError):
            second.save()
        self.assertEqual(rial(self.user), 100_000)
        self.assertEqual(CurrencyTransaction.objects.get().status, "failed")

    def test_another_users_bank_account_is_refused(self):
        other = make_customer("9120000702")
        self.bank_account.user = other
        self.bank_account.save()
        self.assertEqual(self.withdraw(10_000).status_code, 404)
        self.assertEqual(rial(self.user), 100_000)


@override_settings(CACHES=LOCMEM)
class PointsAccountTests(TestCase):
    def test_points_go_to_the_points_token_only(self):
        from apps.wallet.services.game_play.charge import (  # pylint: disable=import-outside-toplevel
            GamePlayChargeService,
        )
        from apps.configuration.models import GameConfiguration  # pylint: disable=import-outside-toplevel

        user = make_customer("9120000711", points=50)
        # A newer account for another token in the same wallet must never be charged.
        l_account = balance.points_account(user)
        other = TokenWalletAccount.objects.get(pk=l_account.pk)
        other.pk = None
        other.id = None
        other.token = type(l_account.token).objects.create(symbol="X", name="Other", price=1)
        other.amount = 999
        other.save()
        GameConfiguration.objects.update_or_create(game_name="sudoku", defaults={"play_cost": 5})
        GamePlayChargeService().charge(user, "sudoku")
        self.assertEqual(points(user), 45)
        other.refresh_from_db()
        self.assertEqual(other.amount, 999)

    def test_charge_refuses_when_points_run_out(self):
        from apps.wallet.services.game_play.charge import (  # pylint: disable=import-outside-toplevel
            GamePlayChargeService,
        )
        from apps.configuration.models import GameConfiguration  # pylint: disable=import-outside-toplevel

        user = make_customer("9120000712", points=3)
        GameConfiguration.objects.update_or_create(game_name="sudoku", defaults={"play_cost": 5})
        with self.assertRaises(ValidationError):
            GamePlayChargeService().charge(user, "sudoku")
        self.assertEqual(points(user), 3)


@override_settings(CACHES=LOCMEM)
class WheelTests(TestCase):
    def setUp(self):
        self.user = make_customer("9120000721", points=100)
        self.victim = make_customer("9120000722", points=100)
        sponsor = Sponsor.objects.create(user=make_customer("9120000723"))
        self.wheel = LotteryWheel.objects.create(
            name="w", owner=sponsor, cost_per_spin=10, max_spins=100, max_spins_per_customer=10
        )
        LotteryWheelPrize.objects.create(
            lottery_wheel=self.wheel,
            name="empty",
            prize_amount=0,
            probability=100,
            prize_type=LotteryWheelPrize.PrizeType.EMPTY,
        )
        self.api = APIClient()
        self.api.force_authenticate(self.user)

    def test_spin_is_paid_from_the_players_own_account(self):
        victim_account = balance.points_account(self.victim)
        r = self.api.post(
            "/api/v1/lotteries/lottery-wheel/spin/",
            {"lottery_wheel": str(self.wheel.pk), "token_wallet_account": str(victim_account.pk)},
            format="json",
        )
        self.assertIn(r.status_code, (200, 201), r.content)
        self.assertEqual(points(self.victim), 100)
        self.assertEqual(points(self.user), 90)


@override_settings(CACHES=LOCMEM)
class PrizeTransferTests(TestCase):
    def test_prize_reaches_the_winners_currency_account(self):
        from apps.wallet.services.currency_wallet_account.transfer import (  # pylint: disable=import-outside-toplevel
            CurrencyWalletAccountTransferService as T,
        )

        user = make_customer("9120000731", rial=5)
        T().send_prize_to_customer(
            T.SendPrizeToCustomerDTO(
                prize_amount=Decimal(1000),
                customer=user.customer,
                destination_wallet_account=balance.currency_account(user),
            )
        )
        self.assertEqual(rial(user), 1005)


@override_settings(CACHES=LOCMEM)
class HistoryTests(TestCase):
    """Codex review 2026-10-22 (phase 3b): every movement once, signed, in its own history."""

    def setUp(self):
        from apps.configuration.models import GameConfiguration  # pylint: disable=import-outside-toplevel

        self.user = make_customer("9120000741", points=100, rial=0)
        self.api = APIClient()
        self.api.force_authenticate(self.user)
        GameConfiguration.objects.update_or_create(game_name="sudoku", defaults={"play_cost": 5})

    def rows(self, kind):
        account = balance.points_account(self.user) if kind == "points" else balance.currency_account(self.user)
        url = (
            f"/api/v1/wallet/points/transactions/?token_wallet_account_id={account.pk}"
            if kind == "points"
            else f"/api/v1/wallet/currency/transactions/?currency_wallet_account_id={account.pk}"
        )
        r = self.api.get(url)
        self.assertEqual(r.status_code, 200, r.content)
        body = r.json()
        return body.get("result", body)["results"]

    def test_points_history_adds_up_to_the_balance(self):
        from apps.wallet.services.game_play.charge import (  # pylint: disable=import-outside-toplevel
            GamePlayChargeService,
        )

        GamePlayChargeService().charge(self.user, "sudoku")
        GamePlayChargeService().charge(self.user, "sudoku")
        rows = self.rows("points")
        moved = sum((1 if r["is_positive"] else -1) * Decimal(r["amount"]) for r in rows)
        self.assertEqual(points(self.user), 100 + moved)
        self.assertEqual([r["title"] for r in rows], ["بازی سودوکو", "بازی سودوکو"])
        self.assertIn("T", rows[0]["date"])  # a moment, not just a day

    def test_activity_reward_needs_a_paid_play_and_shows_in_history(self):
        from apps.configuration.models import ScoreConfiguration  # pylint: disable=import-outside-toplevel
        from apps.configuration.services.scoring import RecordActionService  # pylint: disable=import-outside-toplevel
        from apps.wallet.services.game_play.charge import (  # pylint: disable=import-outside-toplevel
            GamePlayChargeService,
        )

        ScoreConfiguration.objects.create(section="sudoku", action_type="win_game", score_value=7)
        with self.assertRaises(ValueError):
            RecordActionService.record_action(self.user, "sudoku", "win_game")
        GamePlayChargeService().charge(self.user, "sudoku")
        before = points(self.user)
        RecordActionService.record_action(self.user, "sudoku", "win_game")
        self.assertEqual(points(self.user), before + 7)
        self.assertIn("activity_reward", {r["type"] for r in self.rows("points")})

    def test_withdrawals_show_their_state_in_the_currency_history(self):
        CurrencyWalletAccount.objects.filter(wallet__owner=self.user).update(balance=50_000)
        bank = Bank.objects.create(name="Test bank", code="T2")
        account = BankAccount.objects.create(
            user=self.user, iban="IR062960000000100324200001", bank=bank,
            account_holder="Test", status=BankAccount.Status.APPROVED,
        )
        self.api.post(WITHDRAW, {"amount": 20_000, "bank_account_id": str(account.pk)}, format="json")
        tx = CurrencyTransaction.objects.get()
        tx.status = CurrencyTransaction.Status.FAILED
        tx.save()
        (row,) = self.rows("currency")
        self.assertEqual((row["type"], row["is_positive"], row["status"]), ("withdrawal", False, "failed"))
        self.assertTrue(row["status_label"])
        self.assertEqual(rial(self.user), 50_000)

    def test_cash_wheel_prize_is_in_the_currency_history_with_the_paid_amount(self):
        from apps.wallet.models import LotteryWheelPrizeTransaction  # pylint: disable=import-outside-toplevel

        sponsor = Sponsor.objects.create(user=make_customer("9120000742"))
        wheel = LotteryWheel.objects.create(name="w", owner=sponsor, cost_per_spin=0)
        prize = LotteryWheelPrize.objects.create(
            lottery_wheel=wheel, name="cash", prize_amount=100, probability=100,
            prize_type=LotteryWheelPrize.PrizeType.CASH,
        )
        LotteryWheelPrizeTransaction.objects.create(
            lottery_wheel=wheel, prize=prize, customer=self.user.customer,
            amount=500, prize_type="cash", status="completed",
        )
        prize.prize_amount = 200  # edited later: history keeps what was paid
        prize.save()
        self.assertEqual([Decimal(r["amount"]) for r in self.rows("currency")], [500])
        self.assertNotIn("wheel_prize", {r["type"] for r in self.rows("points")})


class IbanTests(TestCase):
    def test_sheba_numbers_are_checked(self):
        from apps.wallet.services.iban import is_valid_iban, normalize_iban  # pylint: disable=import-outside-toplevel

        self.assertTrue(is_valid_iban(normalize_iban("IR06 2960 0000 0010 0324 2000 01")))
        self.assertTrue(is_valid_iban(normalize_iban("۰۶۲۹۶۰۰۰۰۰۰۰۱۰۰۳۲۴۲۰۰۰۰۱")))
        self.assertFalse(is_valid_iban(normalize_iban("IR" + "0" * 24)))
        self.assertFalse(is_valid_iban(normalize_iban("x")))


@override_settings(CACHES=LOCMEM)
class GuardTests(TestCase):
    def test_an_activity_is_rewarded_once_per_customer_in_the_database(self):
        from django.db import IntegrityError, transaction  # pylint: disable=import-outside-toplevel

        from apps.wallet.models import ActivityTransaction  # pylint: disable=import-outside-toplevel

        user = make_customer("9120000751")
        ActivityTransaction.objects.create(customer=user.customer, section="sudoku", action_type="win_game")
        with self.assertRaises((IntegrityError, ValidationError)), transaction.atomic():
            ActivityTransaction.objects.create(customer=user.customer, section="sudoku", action_type="win_game")

    def test_games_refuse_an_inactive_points_account(self):
        from apps.crash.services import rounds  # pylint: disable=import-outside-toplevel

        user = make_customer("9120000752", points=500)
        TokenWalletAccount.objects.filter(wallet__owner=user).update(status="blocked")
        with self.assertRaises(rounds.CrashError):
            rounds.place_bet(user, 10, None)
        self.assertEqual(points(user), 500)

    def test_wheel_spin_limit_holds_in_the_spin_itself(self):
        from apps.lottery.services.lottery.lottery_wheel import (  # pylint: disable=import-outside-toplevel
            LotteryWheelService,
        )

        user = make_customer("9120000753", points=100)
        sponsor = Sponsor.objects.create(user=make_customer("9120000754"))
        wheel = LotteryWheel.objects.create(
            name="w", owner=sponsor, cost_per_spin=10, max_spins=100, max_spins_per_customer=1
        )
        LotteryWheelPrize.objects.create(
            lottery_wheel=wheel, name="empty", prize_amount=0, probability=100,
            prize_type=LotteryWheelPrize.PrizeType.EMPTY,
        )
        service = LotteryWheelService()
        dto = service.SpinWheelDTO(
            customer=user.customer, lottery_wheel=wheel,
            token_wallet_account=balance.points_account(user), multiplier=1,
        )
        service.spin_wheel(dto)
        with self.assertRaises(ValidationError):
            service.spin_wheel(dto)  # both passed the serializer's check
        self.assertEqual(points(user), 90)


@override_settings(CACHES=LOCMEM)
class HistoryDestinationTests(TestCase):
    def test_a_pending_lottery_prize_is_marked_as_not_paid(self):
        from apps.lottery.models import Lottery, Ticket  # pylint: disable=import-outside-toplevel
        from apps.wallet.models import LotteryPrizeTransaction  # pylint: disable=import-outside-toplevel
        from apps.wallet.services.history import currency_history  # pylint: disable=import-outside-toplevel

        user = make_customer("9120000761")
        sponsor = Sponsor.objects.create(user=make_customer("9120000762"))
        lottery = Lottery.objects.create(
            name="l", owner=sponsor, ticket_price=1, status="completed",
            token=balance.points_account(user).token,
        )
        ticket = Ticket.objects.create(lottery=lottery, customer=user.customer, numbers=[1, 2, 3, 4, 5, 6], name="t")
        LotteryPrizeTransaction.objects.create(
            lottery=lottery, ticket=ticket, prize_amount=500, status="pending"
        )
        (row,) = currency_history(user)
        self.assertEqual((row["status"], row["status_label"]), ("pending", "در انتظار پرداخت"))


@override_settings(CACHES=LOCMEM)
class Phase5Tests(TestCase):
    """Codex review 2026-10-23 (phase 5): rewards, caps and the wheel."""

    def setUp(self):
        from apps.configuration.models import GameConfiguration, ScoreConfiguration  # pylint: disable=import-outside-toplevel

        self.user = make_customer("9120000771", points=100)
        GameConfiguration.objects.update_or_create(game_name="sudoku", defaults={"play_cost": 5})
        ScoreConfiguration.objects.create(section="sudoku", action_type="win_game", score_value=7)

    def play(self):
        from apps.wallet.services.game_play.charge import (  # pylint: disable=import-outside-toplevel
            GamePlayChargeService,
        )

        GamePlayChargeService().charge(self.user, "sudoku")

    def test_an_unknown_difficulty_is_refused(self):
        from apps.configuration.services.scoring import RecordActionService  # pylint: disable=import-outside-toplevel

        self.play()
        before = points(self.user)
        with self.assertRaises(ValueError):
            RecordActionService.record_action(
                self.user, "sudoku", "win_game", metadata={"difficulty": "not-a-level"}
            )
        self.assertEqual(points(self.user), before)

    def test_an_old_play_does_not_unlock_rewards(self):
        from datetime import timedelta  # pylint: disable=import-outside-toplevel

        from django.utils import timezone  # pylint: disable=import-outside-toplevel

        from apps.configuration.services.scoring import RecordActionService  # pylint: disable=import-outside-toplevel
        from apps.wallet.models import GamePlayCharge  # pylint: disable=import-outside-toplevel

        self.play()
        GamePlayCharge.objects.update(create_time=timezone.now() - timedelta(hours=4))
        with self.assertRaises(ValueError):
            RecordActionService.record_action(self.user, "sudoku", "win_game")

    def make_wheel(self, prizes, status="active"):
        sponsor = Sponsor.objects.create(user=make_customer("9120000772"))
        wheel = LotteryWheel.objects.create(
            name="w", owner=sponsor, cost_per_spin=10, max_spins=100, max_spins_per_customer=10, status=status
        )
        for i, (kind, amount, chance) in enumerate(prizes):
            LotteryWheelPrize.objects.create(
                lottery_wheel=wheel, name=f"p{i}", prize_type=kind, prize_amount=amount, probability=chance
            )
        return wheel

    def spin(self, wheel):
        from apps.lottery.services.lottery.lottery_wheel import (  # pylint: disable=import-outside-toplevel
            LotteryWheelService,
        )

        service = LotteryWheelService()
        return service.spin_wheel(
            service.SpinWheelDTO(
                customer=self.user.customer, lottery_wheel=wheel,
                token_wallet_account=balance.points_account(self.user), multiplier=5,
            )
        )

    def test_an_inactive_wheel_cannot_be_spun(self):
        wheel = self.make_wheel([("empty", 0, 100)], status="inactive")
        with self.assertRaises(ValidationError):
            self.spin(wheel)
        self.assertEqual(points(self.user), 100)
        api = APIClient()
        api.force_authenticate(self.user)
        r = api.post("/api/v1/lotteries/lottery-wheel/spin/", {"lottery_wheel": str(wheel.pk)}, format="json")
        self.assertEqual(r.status_code, 400, r.content)

    def test_a_wheel_without_an_empty_slice_is_refused(self):
        wheel = self.make_wheel([("recharge", 20, 100)])
        with self.assertRaises(ValidationError):
            self.spin(wheel)
        self.assertEqual(points(self.user), 100)
