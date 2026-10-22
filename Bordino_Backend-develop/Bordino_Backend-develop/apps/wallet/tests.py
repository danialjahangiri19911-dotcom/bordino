from decimal import Decimal

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
