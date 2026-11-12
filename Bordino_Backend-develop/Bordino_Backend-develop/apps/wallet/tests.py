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
        import uuid  # pylint: disable=import-outside-toplevel

        extra.setdefault("request_id", str(uuid.uuid4()))
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
            {"request_id": "own-1", "lottery_wheel": str(self.wheel.pk), "token_wallet_account": str(victim_account.pk)},
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
        # (these tests check the cash-wallet payouts and set their own game prices: the coin defaults
        # of 2026-11-12 — cash prizes as coins, the seeded entry fees — are switched off here)
        from apps.configuration.models import GameConfiguration as _GC, SystemConfiguration as _SC  # pylint: disable=import-outside-toplevel

        _SC.objects.update_or_create(key="CASH_PRIZES_AS_COINS", defaults={"value": "false"})
        _GC.objects.all().delete()
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
        # 2048: the Sudoku board rewards are paid by the server's board check (apps/crash sudoku).
        from apps.configuration.models import ScoreConfiguration  # pylint: disable=import-outside-toplevel
        from apps.configuration.services.scoring import RecordActionService  # pylint: disable=import-outside-toplevel
        from apps.wallet.services.game_play.charge import (  # pylint: disable=import-outside-toplevel
            GamePlayChargeService,
        )

        ScoreConfiguration.objects.create(section="game_2048", action_type="win_game", score_value=7)
        with self.assertRaises(ValueError):
            RecordActionService.record_action(self.user, "game_2048", "win_game")
        GamePlayChargeService().charge(self.user, "game_2048")
        before = points(self.user)
        RecordActionService.record_action(self.user, "game_2048", "win_game")
        self.assertEqual(points(self.user), before + 7)
        self.assertIn("activity_reward", {r["type"] for r in self.rows("points")})

    def test_withdrawals_show_their_state_in_the_currency_history(self):
        CurrencyWalletAccount.objects.filter(wallet__owner=self.user).update(balance=50_000)
        bank = Bank.objects.create(name="Test bank", code="T2")
        account = BankAccount.objects.create(
            user=self.user, iban="IR062960000000100324200001", bank=bank,
            account_holder="Test", status=BankAccount.Status.APPROVED,
        )
        self.api.post(WITHDRAW, {"amount": 20_000, "bank_account_id": str(account.pk), "request_id": "h-1"}, format="json")
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
        GameConfiguration.objects.update_or_create(game_name="game_2048", defaults={"play_cost": 5})
        ScoreConfiguration.objects.create(section="game_2048", action_type="win_game", score_value=7)

    def play(self):
        from apps.wallet.services.game_play.charge import (  # pylint: disable=import-outside-toplevel
            GamePlayChargeService,
        )

        GamePlayChargeService().charge(self.user, "game_2048")

    def test_an_unknown_difficulty_is_refused(self):
        from apps.configuration.services.scoring import RecordActionService  # pylint: disable=import-outside-toplevel

        self.play()
        before = points(self.user)
        with self.assertRaises(ValueError):
            RecordActionService.record_action(
                self.user, "game_2048", "win_game", metadata={"difficulty": "not-a-level"}
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
            RecordActionService.record_action(self.user, "game_2048", "win_game")

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


MELLAT_IBAN = "IR700120000000000000000000"  # valid check digits, bank code 012
MELLI_IBAN = "IR060170000000000000000000"  # bank code 017


@override_settings(CACHES=LOCMEM)
class BankListTests(TestCase):
    """The withdrawal form's bank list was empty: the banks are seeded with their Sheba codes."""

    def setUp(self):
        self.user = make_customer("9120000801")
        self.api = APIClient()
        self.api.force_authenticate(self.user)

    def test_iranian_banks_are_listed_on_one_page(self):
        response = self.api.get("/api/v1/wallet/banks/?page_size=100")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        rows = (body.get("result") or body)["results"]
        names = {r["name"]: r["code"] for r in rows}
        self.assertGreaterEqual(len(rows), 25)
        self.assertEqual(names["بانک ملت"], "012")
        self.assertEqual(names["بانک ملی ایران"], "017")
        self.assertTrue(all(r["id"] for r in rows))

    def test_a_sheba_number_of_another_bank_is_refused(self):
        mellat = Bank.objects.get(code="012")
        melli = Bank.objects.get(code="017")
        url = "/api/v1/wallet/bank-accounts/"
        wrong = self.api.post(url, {"iban": MELLAT_IBAN, "bank": str(melli.pk), "account_holder": "علی رضایی"}, format="json")
        self.assertEqual(wrong.status_code, 400)
        self.assertIn("بانک ملت", str(wrong.json()))
        right = self.api.post(url, {"iban": MELLAT_IBAN, "bank": str(mellat.pk), "account_holder": "علی رضایی"}, format="json")
        self.assertEqual(right.status_code, 201, right.content)
        self.assertEqual(BankAccount.objects.get(user=self.user).bank, mellat)

    def test_profile_counts_every_ticket_ever_held(self):
        response = self.api.get("/api/v1/customer/profile/me/")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual((body.get("result") or body)["tickets_total"], 0)

    def test_the_points_wallet_carries_the_new_brand_name(self):
        account = balance.points_account(self.user)
        self.assertNotIn("بوردینو", account.name)


@override_settings(CACHES=LOCMEM)
class AdRewardTests(TestCase):
    """A rewarded video before a game: paid by the server, once, after the whole video."""

    OFFER = "/api/v1/wallet/ad-reward/offer/"
    START = "/api/v1/wallet/ad-reward/sessions/"

    def setUp(self):
        from django.core.cache import cache  # pylint: disable=import-outside-toplevel

        cache.clear()
        self.user = make_customer("9120000901", points=100)
        self.api = APIClient()
        self.api.force_authenticate(self.user)

    def body(self, response):
        data = response.json()
        return data.get("result", data) if isinstance(data, dict) else data

    def start(self):
        response = self.api.post(self.START, {"placement": "sudoku"}, format="json")
        self.assertEqual(response.status_code, 201, response.content)
        return self.body(response)

    def watched(self, session_id, seconds=20):
        from datetime import timedelta  # pylint: disable=import-outside-toplevel

        from django.utils import timezone  # pylint: disable=import-outside-toplevel

        from apps.wallet.models import AdRewardSession  # pylint: disable=import-outside-toplevel

        AdRewardSession.objects.filter(pk=session_id).update(create_time=timezone.now() - timedelta(seconds=seconds))

    def complete(self, session_id):
        return self.api.post(f"{self.START}{session_id}/complete/", {}, format="json")

    def test_the_offer_says_how_many_points_and_what_to_play(self):
        offer = self.body(self.api.get(self.OFFER))
        self.assertTrue(offer["available"])
        self.assertEqual(offer["reward_points"], 5)
        self.assertEqual(offer["provider"], "demo")
        self.assertTrue(offer["creative"]["video_url"])

    def test_no_points_before_the_video_has_had_time_to_play(self):
        session = self.start()
        response = self.complete(session["session_id"])
        self.assertEqual(response.status_code, 409)
        self.assertEqual(points(self.user), 100)

    def test_a_watched_video_pays_once(self):
        session = self.start()
        self.watched(session["session_id"])
        first = self.complete(session["session_id"])
        self.assertEqual(first.status_code, 200, first.content)
        self.assertFalse(self.body(first)["already_rewarded"])
        self.assertEqual(self.body(first)["points_balance"], 105)
        again = self.complete(session["session_id"])
        self.assertEqual(again.status_code, 200)
        self.assertTrue(self.body(again)["already_rewarded"])
        self.assertEqual(points(self.user), 105)

    def test_another_players_session_pays_nothing(self):
        session = self.start()
        self.watched(session["session_id"])
        other = APIClient()
        other.force_authenticate(make_customer("9120000902"))
        self.assertEqual(other.post(f"{self.START}{session['session_id']}/complete/", {}, format="json").status_code, 409)
        self.assertEqual(points(self.user), 100)

    def test_not_a_second_before_the_whole_video(self):
        session = self.start()
        self.watched(session["session_id"], seconds=14)
        self.assertEqual(self.complete(session["session_id"]).status_code, 409)
        self.watched(session["session_id"], seconds=15)
        self.assertEqual(self.complete(session["session_id"]).status_code, 200)

    def test_an_old_session_cannot_be_claimed(self):
        session = self.start()
        self.watched(session["session_id"], seconds=60 * 60)
        self.assertEqual(self.complete(session["session_id"]).status_code, 409)

    def test_the_daily_limit_and_the_amount_come_from_the_configuration(self):
        from apps.configuration.models import SystemConfiguration  # pylint: disable=import-outside-toplevel

        SystemConfiguration.objects.filter(key="AD_REWARD_DAILY_LIMIT").update(value="1")
        SystemConfiguration.objects.filter(key="AD_REWARD_POINTS").update(value="8")
        session = self.start()
        self.assertEqual(session["reward_points"], 8)
        self.watched(session["session_id"])
        self.assertEqual(self.complete(session["session_id"]).status_code, 200)
        self.assertEqual(points(self.user), 108)
        offer = self.body(self.api.get(self.OFFER))
        self.assertFalse(offer["available"])
        self.assertEqual(self.api.post(self.START, {}, format="json").status_code, 409)

    def test_the_reward_is_in_the_points_history_and_not_claimable_by_record_action(self):
        from apps.configuration.services.scoring import RecordActionService  # pylint: disable=import-outside-toplevel

        session = self.start()
        self.watched(session["session_id"])
        self.complete(session["session_id"])
        rows = self.body(self.api.get("/api/v1/wallet/points/transactions/"))
        rows = rows.get("results", rows) if isinstance(rows, dict) else rows
        self.assertIn("جایزهٔ تماشای ویدیو", {r["title"] for r in rows})
        with self.assertRaises(ValueError):
            RecordActionService.record_action(self.user, "rewarded_ad", "ad:forged")
        self.assertEqual(points(self.user), 105)



@override_settings(CACHES=LOCMEM)
class AuditPhase1Tests(TestCase):
    """Full Codex audit, phase 1 (2026-10-28): money integrity."""

    def setUp(self):
        from django.core.cache import cache  # pylint: disable=import-outside-toplevel

        cache.clear()
        self.user = make_customer("9120002001", points=100, rial=100_000)
        self.api = APIClient()
        self.api.force_authenticate(self.user)

    def test_an_admin_adjustment_adds_to_the_balance_of_that_moment_and_is_in_the_history(self):
        from apps.wallet.services.adjust import adjust_points  # pylint: disable=import-outside-toplevel

        stale = balance.points_account(self.user)  # read at 100
        balance.add_points(stale, -30)  # a purchase in between → 70
        adjust_points(stale, 100)  # the old code saved 100 + 100 = 200
        self.assertEqual(points(self.user), 170)
        rows = self.api.get("/api/v1/wallet/points/transactions/").json()
        rows = (rows.get("result") or rows)
        rows = rows.get("results", rows) if isinstance(rows, dict) else rows
        self.assertIn("تنظیم سکه توسط پشتیبانی", {r["title"] for r in rows})

    def test_a_cancelled_reward_takes_back_what_was_posted_not_an_edited_amount(self):
        from apps.wallet.models import ActivityTransaction  # pylint: disable=import-outside-toplevel

        tx = ActivityTransaction.objects.create(
            customer=self.user.customer, section="admin_adjust", action_type="t-1", score_value=10,
            reward_data={}, status=ActivityTransaction.Status.COMPLETED,
        )
        self.assertEqual(points(self.user), 110)
        tx.score_value = 100  # edited in the admin, then cancelled
        tx.status = ActivityTransaction.Status.CANCELLED
        tx.save()
        self.assertEqual(points(self.user), 100)
        tx.refresh_from_db()
        self.assertEqual(tx.score_value, 10)

    def test_deleting_a_stale_copy_of_a_cancelled_reward_takes_nothing_more(self):
        from apps.wallet.models import ActivityTransaction  # pylint: disable=import-outside-toplevel

        tx = ActivityTransaction.objects.create(
            customer=self.user.customer, section="admin_adjust", action_type="t-2", score_value=10,
            reward_data={}, status=ActivityTransaction.Status.COMPLETED,
        )
        stale = ActivityTransaction.objects.get(pk=tx.pk)  # loaded while still completed
        tx.status = ActivityTransaction.Status.CANCELLED
        tx.save()
        self.assertEqual(points(self.user), 100)
        stale.delete()  # the old code read stale.status (completed) and took 10 again
        self.assertEqual(points(self.user), 100)

    def test_a_bank_account_with_withdrawals_cannot_be_hard_deleted(self):
        from django.db.models import ProtectedError  # pylint: disable=import-outside-toplevel

        account = BankAccount.objects.create(
            user=self.user, iban="IR700120000000000000000000", bank=Bank.objects.get(code="012"),
            account_holder="x", status=BankAccount.Status.APPROVED,
        )
        self.assertEqual(self.api.post(WITHDRAW, {"amount": 40_000, "bank_account_id": str(account.pk), "request_id": "w-1"}, format="json").status_code, 201)
        with self.assertRaises(ProtectedError):
            account.delete()

    def test_a_withdrawal_without_a_request_id_is_refused(self):
        account = BankAccount.objects.create(
            user=self.user, iban="IR700120000000000000000000", bank=Bank.objects.get(code="012"),
            account_holder="x", status=BankAccount.Status.APPROVED,
        )
        self.assertEqual(self.api.post(WITHDRAW, {"amount": 10_000, "bank_account_id": str(account.pk)}, format="json").status_code, 400)
        self.assertEqual(rial(self.user), 100_000)

    def test_a_retried_game_charge_charges_once(self):
        from apps.configuration.models import GameConfiguration  # pylint: disable=import-outside-toplevel

        GameConfiguration.objects.filter(game_name="sudoku").delete()
        GameConfiguration.objects.create(game_name="sudoku", difficulty_level="easy", timer=600, play_cost=3)
        url = "/api/v1/wallet/games/charge/"
        for _ in range(2):
            self.assertEqual(self.api.post(url, {"game_name": "sudoku", "request_id": "play-1"}, format="json").status_code, 200)
        self.assertEqual(points(self.user), 97)
        self.assertEqual(self.api.post(url, {"game_name": "game_2048", "request_id": "play-1"}, format="json").status_code, 400)
        self.api.post(url, {"game_name": "sudoku", "request_id": "play-2"}, format="json")
        self.assertEqual(points(self.user), 94)

    def test_an_unknown_ad_provider_offers_nothing(self):
        from apps.configuration.models import SystemConfiguration  # pylint: disable=import-outside-toplevel

        SystemConfiguration.objects.filter(key="AD_REWARD_PROVIDER").update(value="adddelivery-typo")
        offer = self.api.get("/api/v1/wallet/ad-reward/offer/").json()
        self.assertFalse((offer.get("result") or offer)["available"])
        self.assertEqual(self.api.post("/api/v1/wallet/ad-reward/sessions/", {}, format="json").status_code, 409)


@override_settings(CACHES=LOCMEM)
class SecurityAuditWalletTests(TestCase):
    """Codex security audit 2026-10-29 (wallet, money and result APIs)."""

    def setUp(self):
        self.user = make_customer("9120004201", points=100, rial=500_000)

    def test_an_admin_save_does_not_write_back_a_stale_points_balance(self):
        from types import SimpleNamespace  # pylint: disable=import-outside-toplevel

        from django.contrib.admin.sites import site  # pylint: disable=import-outside-toplevel
        from django.test import RequestFactory  # pylint: disable=import-outside-toplevel

        stale = TokenWalletAccount.objects.get(pk=balance.points_account(self.user).pk)  # page loaded at 100
        balance.add_points(balance.points_account(self.user), -30)  # a game charge meanwhile
        stale.name = "renamed"
        request = RequestFactory().post("/")
        request.user = get_user_model().objects.create_superuser(phone_number="9120004299", password="x")
        form = SimpleNamespace(changed_data=["name"], cleaned_data={"adjust_by": 100})
        site._registry[TokenWalletAccount].save_model(request, stale, form, True)  # pylint: disable=protected-access
        fresh = TokenWalletAccount.objects.get(pk=stale.pk)
        self.assertEqual((fresh.name, int(fresh.amount)), ("renamed", 170))

    def test_an_admin_save_does_not_write_back_a_stale_cash_balance(self):
        from types import SimpleNamespace  # pylint: disable=import-outside-toplevel

        from django.contrib.admin.sites import site  # pylint: disable=import-outside-toplevel

        account = CurrencyWalletAccount.objects.filter(wallet__owner=self.user).first()
        stale = CurrencyWalletAccount.objects.get(pk=account.pk)
        CurrencyWalletAccount.objects.filter(pk=account.pk).update(balance=100_000)  # a withdrawal meanwhile
        stale.name = "renamed"
        site._registry[CurrencyWalletAccount].save_model(None, stale, SimpleNamespace(changed_data=["name"]), True)  # pylint: disable=protected-access
        fresh = CurrencyWalletAccount.objects.get(pk=account.pk)
        self.assertEqual((fresh.name, int(fresh.balance)), ("renamed", 100_000))

    def test_the_app_can_only_record_events_that_pay_nothing(self):
        from apps.configuration.models import GameConfiguration, ScoreConfiguration  # pylint: disable=import-outside-toplevel

        GameConfiguration.objects.update_or_create(game_name="game_2048", defaults={"play_cost": 1})
        ScoreConfiguration.objects.create(section="game_2048", action_type="win_game", score_value=7)
        api = APIClient()
        api.force_authenticate(self.user)
        api.post("/api/v1/wallet/games/charge/", {"game_name": "game_2048", "request_id": "p1"}, format="json")
        before = points(self.user)
        r = api.post("/api/v1/activity/record-action/", {"section": "game_2048", "action_type": "win_game"}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(points(self.user), before)

    def make_wheel(self, max_spins=100):
        sponsor_user = getattr(self, "_sponsor", None) or make_customer("9120004202")
        self._sponsor = sponsor_user
        sponsor, _ = Sponsor.objects.get_or_create(user=sponsor_user)
        wheel = LotteryWheel.objects.create(name="w", owner=sponsor, cost_per_spin=10, max_spins=max_spins, max_spins_per_customer=10)
        prize = LotteryWheelPrize.objects.create(lottery_wheel=wheel, name="p", prize_amount=5, probability=50, prize_type=LotteryWheelPrize.PrizeType.RECHARGE)
        LotteryWheelPrize.objects.create(lottery_wheel=wheel, name="empty", prize_amount=0, probability=50, prize_type=LotteryWheelPrize.PrizeType.EMPTY)
        return wheel, prize

    def spin(self, wheel, request_id, multiplier=1):
        from apps.lottery.services.lottery.lottery_wheel import LotteryWheelService  # pylint: disable=import-outside-toplevel

        api = APIClient()
        api.force_authenticate(self.user)
        # The draw is pinned to the 5-point prize (a fresh copy: the service scales it in memory).
        draw = lambda prizes, multiplier: LotteryWheelPrize.objects.get(lottery_wheel=wheel, name="p")  # noqa: E731
        with mock.patch.object(LotteryWheelService, "select_prize", side_effect=draw):
            return api.post("/api/v1/lotteries/lottery-wheel/spin/", {"lottery_wheel": str(wheel.pk), "request_id": request_id, "multiplier": multiplier}, format="json")

    def test_a_retried_wheel_spin_is_answered_even_at_the_limit_and_with_the_amount_paid(self):
        wheel, prize = self.make_wheel(max_spins=1)
        first = self.spin(wheel, "s1")
        self.assertIn(first.status_code, (200, 201), first.content)
        after = points(self.user)
        LotteryWheelPrize.objects.filter(pk=prize.pk).update(prize_amount=500)  # an admin edit since
        again = self.spin(wheel, "s1")  # the wheel is full now; a retry is still the same spin
        self.assertIn(again.status_code, (200, 201), again.content)
        self.assertEqual(points(self.user), after)
        # The replay reports what was paid then (5), not the prize as edited since (500).
        from apps.lottery.models import LotteryWheelSpinLog  # pylint: disable=import-outside-toplevel
        from apps.lottery.services.lottery.lottery_wheel import LotteryWheelService  # pylint: disable=import-outside-toplevel

        self.assertEqual(int(LotteryWheelSpinLog.objects.get(request_id="s1").paid_amount), 5)
        prize_back, _ = LotteryWheelService().spin_wheel(
            LotteryWheelService.SpinWheelDTO(
                customer=self.user.customer, lottery_wheel=wheel, token_wallet_account=balance.points_account(self.user), request_id="s1"
            )
        )
        self.assertEqual(int(prize_back.prize_amount), 5)

    def test_a_request_id_reused_for_another_wheel_or_multiplier_is_refused(self):
        wheel, _ = self.make_wheel()
        other, _ = self.make_wheel()
        self.assertIn(self.spin(wheel, "s2").status_code, (200, 201))
        self.assertEqual(self.spin(other, "s2").status_code, 400)
        self.assertEqual(self.spin(wheel, "s2", multiplier=2).status_code, 400)
