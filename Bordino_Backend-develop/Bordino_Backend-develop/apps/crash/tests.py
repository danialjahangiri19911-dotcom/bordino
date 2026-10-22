import hashlib
import hmac
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.crash.models import CrashConfiguration, CrashRound
from apps.crash.services import fair, rounds
from apps.user_management.services.user.registration import UserRegistrationService
from apps.wallet.models import TokenWalletAccount

D = Decimal
LOCMEM = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}


def at(round_, multiplier, extra_ms=1):
    """The moment the curve of `round_` shows `multiplier`."""
    return round_.started_at + timedelta(milliseconds=fair.ms_to_reach(D(multiplier)) + extra_ms)


class FairTests(TestCase):
    def test_crash_point_matches_the_published_formula(self):
        for nonce in range(200):
            digest = hmac.new(b"server", f"client:{nonce}".encode(), hashlib.sha256).digest()
            x = int.from_bytes(digest[:4], "big")
            expected = max(D(1), D(int((2**32 / (x + 1)) * 0.99 * 100)) / 100)
            got = fair.crash_point("server", "client", nonce, D("0.01"), D("1000000"))
            # Float reference vs integer implementation may differ by one cent at most.
            self.assertLessEqual(abs(got - expected), D("0.01"), nonce)
            self.assertEqual(got, fair.crash_point("server", "client", nonce, D("0.01"), D("1e6")))

    def test_crash_point_is_capped(self):
        points = [fair.crash_point("s", "c", n, D("0.01"), D("3.00")) for n in range(500)]
        self.assertEqual(max(points), D("3.00"))
        self.assertGreaterEqual(min(points), D("1.00"))

    def test_every_target_returns_about_99_percent(self):
        points = [fair.crash_point("seed", "c", n, D("0.01"), D("1e6")) for n in range(40000)]
        for target in (D("1.5"), D("2"), D("5")):
            hit = sum(1 for p in points if p >= target) / len(points)
            self.assertAlmostEqual(float(target) * hit, 0.99, delta=0.03, msg=str(target))

    def test_curve_lands_on_the_multiplier(self):
        for m in ("1.01", "2.00", "10.00", "123.45"):
            self.assertEqual(fair.multiplier_at(fair.ms_to_reach(D(m))), D(m))
        self.assertEqual(fair.multiplier_at(-5), D("1.00"))

    def test_seed_hash_commits_to_the_seed(self):
        seed = fair.new_server_seed()
        self.assertEqual(fair.hash_seed(seed), hashlib.sha256(seed.encode()).hexdigest())


@override_settings(CACHES=LOCMEM)
class RoundTests(TestCase):
    def setUp(self):
        self.user = self.make_player("9120000101", 1000)
        self.now = timezone.now()

    @staticmethod
    def make_player(phone, points):
        user = get_user_model().objects.create_user(phone_number=phone)
        service = UserRegistrationService()
        service._create_customer_for_user(user)
        service._create_wallet_for_user(user)
        TokenWalletAccount.objects.filter(wallet__owner=user).update(amount=points)
        return user

    def balance(self, user=None):
        return TokenWalletAccount.objects.get(wallet__owner=user or self.user).amount

    def bet(self, amount=100, auto=None, crash="5.00", user=None):
        round_, _ = rounds.place_bet(user or self.user, amount, auto, now=self.now)
        CrashRound.objects.filter(pk=round_.pk).update(crash_point=D(crash))
        round_.refresh_from_db()
        return round_

    def test_bet_debits_the_points_wallet(self):
        round_, balance = rounds.place_bet(self.user, 100, None, now=self.now)
        self.assertEqual(balance, 900)
        self.assertEqual(self.balance(), 900)
        self.assertEqual(round_.status, CrashRound.Status.ACTIVE)
        self.assertEqual(round_.server_seed_hash, fair.hash_seed(round_.server_seed))

    def test_bet_is_rejected_without_enough_points_or_outside_limits(self):
        with self.assertRaises(rounds.CrashError):
            rounds.place_bet(self.user, 1001, None, now=self.now)  # over max_bet and balance
        TokenWalletAccount.objects.filter(wallet__owner=self.user).update(amount=50)
        with self.assertRaises(rounds.CrashError):
            rounds.place_bet(self.user, 100, None, now=self.now)
        with self.assertRaises(rounds.CrashError):
            rounds.place_bet(self.user, 10, D("1.00"), now=self.now)  # auto below 1.01
        self.assertEqual(self.balance(), 50)
        self.assertFalse(CrashRound.objects.exists())

    def test_only_one_round_at_a_time(self):
        self.bet()
        with self.assertRaises(rounds.CrashError):
            rounds.place_bet(self.user, 100, None, now=self.now)
        self.assertEqual(self.balance(), 900)

    def test_cash_out_before_the_crash_pays_bet_times_multiplier(self):
        round_ = self.bet(100, crash="5.00")
        round_ = rounds.cash_out(self.user, round_.pk, now=at(round_, "2.37"))
        self.assertEqual(round_.status, CrashRound.Status.WON)
        self.assertEqual(round_.cashout_multiplier, D("2.37"))
        self.assertEqual(round_.payout, 237)
        self.assertEqual(self.balance(), 900 + 237)

    def test_cash_out_after_the_crash_loses(self):
        round_ = self.bet(100, crash="1.80")
        round_ = rounds.cash_out(self.user, round_.pk, now=at(round_, "1.80"))
        self.assertEqual(round_.status, CrashRound.Status.LOST)
        self.assertEqual(round_.payout, 0)
        self.assertEqual(self.balance(), 900)

    def test_instant_crash_loses_even_at_once(self):
        round_ = self.bet(100, auto="1.01", crash="1.00")
        round_ = rounds.cash_out(self.user, round_.pk, now=round_.started_at)
        self.assertEqual(round_.status, CrashRound.Status.LOST)
        self.assertEqual(self.balance(), 900)

    def test_cash_out_before_start_is_refused(self):
        round_ = self.bet()
        with self.assertRaises(rounds.CrashError):
            rounds.cash_out(self.user, round_.pk, now=self.now)
        self.assertEqual(CrashRound.objects.get().status, CrashRound.Status.ACTIVE)

    def test_second_cash_out_pays_nothing_more(self):
        round_ = self.bet(100, crash="5.00")
        rounds.cash_out(self.user, round_.pk, now=at(round_, "2.00"))
        again = rounds.cash_out(self.user, round_.pk, now=at(round_, "3.00"))
        self.assertEqual(again.cashout_multiplier, D("2.00"))
        self.assertEqual(self.balance(), 1100)

    def test_auto_cash_out_is_paid_after_the_player_left(self):
        round_ = self.bet(100, auto="1.50", crash="3.00")
        self.assertEqual(rounds.settle_due(now=at(round_, "1.49", extra_ms=-1)), 0)
        self.assertEqual(rounds.settle_due(now=at(round_, "10.00")), 1)
        round_.refresh_from_db()
        self.assertEqual((round_.status, round_.cashout_multiplier, round_.payout), ("won", D("1.50"), 150))
        self.assertEqual(self.balance(), 1050)

    def test_auto_target_above_the_crash_loses(self):
        round_ = self.bet(100, auto="4.00", crash="3.00")
        rounds.settle_due(now=at(round_, "3.00"))
        round_.refresh_from_db()
        self.assertEqual(round_.status, CrashRound.Status.LOST)
        self.assertEqual(self.balance(), 900)

    def test_late_manual_cash_out_gets_the_auto_target(self):
        round_ = self.bet(100, auto="2.00", crash="9.00")
        round_ = rounds.cash_out(self.user, round_.pk, now=at(round_, "4.00"))
        self.assertEqual(round_.cashout_multiplier, D("2.00"))

    def test_payout_cap_cashes_out_automatically(self):
        config = CrashConfiguration.current()
        config.max_payout = 150
        config.save()
        round_ = self.bet(100, crash="9.00")
        self.assertEqual(round_.payout_cap_multiplier, D("1.50"))
        rounds.settle_due(now=at(round_, "9.00"))
        round_.refresh_from_db()
        self.assertEqual((round_.status, round_.payout), ("won", 150))

    def test_crash_point_stays_secret_until_the_crash(self):
        round_ = self.bet(100, crash="5.00")
        round_ = rounds.cash_out(self.user, round_.pk, now=at(round_, "2.00"))
        hidden = rounds.round_payload(round_, now=at(round_, "4.99"))
        self.assertIsNone(hidden["crash_point"])
        self.assertIsNone(hidden["server_seed"])
        shown = rounds.round_payload(round_, now=at(round_, "5.00"))
        self.assertEqual(shown["crash_point"], "5.00")
        self.assertEqual(shown["server_seed"], round_.server_seed)

    def test_next_bet_settles_the_previous_round_first(self):
        round_ = self.bet(100, auto="2.00", crash="3.00")
        self.now = at(round_, "3.00")
        rounds.place_bet(self.user, 100, None, now=self.now)
        round_.refresh_from_db()
        self.assertEqual(round_.status, CrashRound.Status.WON)
        self.assertEqual(self.balance(), 900 + 200 - 100)
        self.assertEqual(CrashRound.objects.filter(status="active").count(), 1)


@override_settings(CACHES=LOCMEM)
class ApiTests(TestCase):
    def setUp(self):
        self.user = RoundTests.make_player("9120000201", 1000)
        self.other = RoundTests.make_player("9120000202", 1000)
        self.api = APIClient()
        self.api.force_authenticate(self.user)

    def result(self, response):
        return response.json()["result"]

    def test_bet_and_config(self):
        r = self.api.post("/api/v1/games/crash/rounds/", {"bet": 100, "auto_cashout": "2"}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        body = self.result(r)
        self.assertEqual(body["balance"], 900)
        self.assertIsNone(body["round"]["crash_point"])
        self.assertIsNone(body["round"]["server_seed"])
        config = self.result(self.api.get("/api/v1/games/crash/config/"))
        self.assertEqual(config["active_round"]["id"], body["round"]["id"])
        self.assertEqual(config["balance"], 900)

    def test_cannot_touch_another_players_round(self):
        round_, _ = rounds.place_bet(self.other, 100, None)
        r = self.api.post(f"/api/v1/games/crash/rounds/{round_.pk}/cashout/")
        self.assertEqual(r.status_code, 404)
        token = str(RefreshToken.for_user(self.user).access_token)
        r = self.client.get(
            f"/api/v1/games/crash/rounds/{round_.pk}/wait/", HTTP_AUTHORIZATION=f"Bearer {token}"
        )
        self.assertEqual(r.status_code, 404)

    def test_wait_requires_a_token(self):
        round_, _ = rounds.place_bet(self.user, 100, None)
        r = self.client.get(f"/api/v1/games/crash/rounds/{round_.pk}/wait/")
        self.assertEqual(r.status_code, 401)

    def test_wait_reveals_a_finished_round(self):
        round_, _ = rounds.place_bet(self.user, 100, None)
        CrashRound.objects.filter(pk=round_.pk).update(
            crash_point=D("1.50"), started_at=timezone.now() - timedelta(seconds=30)
        )
        token = str(RefreshToken.for_user(self.user).access_token)
        r = self.client.get(
            f"/api/v1/games/crash/rounds/{round_.pk}/wait/", HTTP_AUTHORIZATION=f"Bearer {token}"
        )
        self.assertEqual(r.status_code, 200, r.content)
        body = self.result(r)
        self.assertEqual(body["round"]["status"], "lost")
        self.assertEqual(body["round"]["crash_point"], "1.50")
        self.assertEqual(body["round"]["server_seed"], CrashRound.objects.get().server_seed)

    def test_wallet_history_lists_bet_and_win(self):
        round_, _ = rounds.place_bet(self.user, 100, D("2.00"))
        CrashRound.objects.filter(pk=round_.pk).update(
            crash_point=D("3.00"), started_at=timezone.now() - timedelta(seconds=60)
        )
        rounds.settle_due()
        rows = self.result(self.api.get("/api/v1/wallet/points/transactions/"))["results"]
        crash_rows = {row["type"]: row for row in rows if row["type"].startswith("crash_")}
        self.assertEqual(set(crash_rows), {"crash_bet", "crash_win"})
        self.assertFalse(crash_rows["crash_bet"]["is_positive"])
        self.assertTrue(crash_rows["crash_win"]["is_positive"])
        self.assertEqual(int(D(str(crash_rows["crash_win"]["amount"]))), 200)

    def test_client_seed_change(self):
        r = self.api.post("/api/v1/games/crash/seed/", {"client_seed": "my-lucky_seed1"}, format="json")
        self.assertEqual(self.result(r)["client_seed"], "my-lucky_seed1")
        round_, _ = rounds.place_bet(self.user, 100, None)
        self.assertEqual(round_.client_seed, "my-lucky_seed1")
        bad = self.api.post("/api/v1/games/crash/seed/", {"client_seed": "bad seed!"}, format="json")
        self.assertEqual(bad.status_code, 400)


from apps.crash.models import ChickenConfiguration, ChickenRound  # noqa: E402
from apps.crash.services import chicken  # noqa: E402


class ChickenFairTests(TestCase):
    def test_multipliers_follow_the_formula(self):
        table = chicken.lane_multipliers(24, D("0.05"), D("0.02"))
        self.assertEqual(len(table), 24)
        self.assertEqual(table[0], D("1.03"))  # 0.98 / 0.95
        self.assertEqual(table[-1], D("3.35"))  # 0.98 / 0.95^24 = 3.356…
        self.assertEqual(chicken.lane_multipliers(16, D("0.44"), D("0.02"))[0], D("1.75"))
        self.assertEqual(table, sorted(table))

    def test_hit_lane_matches_a_hand_computation(self):
        for nonce in range(100):
            expected = None
            for lane in range(1, 20):
                digest = hmac.new(b"srv", f"cli:{nonce}:{lane}".encode(), hashlib.sha256).digest()
                if int.from_bytes(digest[:4], "big") / 2**32 < 0.13:
                    expected = lane
                    break
            self.assertEqual(chicken.hit_lane("srv", "cli", nonce, 19, D("0.13")), expected)

    def test_every_cash_out_lane_returns_about_98_percent(self):
        for lanes, hit in ((24, D("0.05")), (19, D("0.13")), (16, D("0.44"))):
            table = chicken.lane_multipliers(lanes, hit, D("0.02"))
            hits = [chicken.hit_lane("s", "c", n, lanes, hit) for n in range(20000)]
            for lane in (1, 3):
                survived = sum(1 for h in hits if h is None or h > lane) / len(hits)
                self.assertAlmostEqual(float(table[lane - 1]) * survived, 0.98, delta=0.035, msg=f"{hit} lane {lane}")


@override_settings(CACHES=LOCMEM)
class ChickenRoundTests(TestCase):
    def setUp(self):
        self.user = RoundTests.make_player("9120000301", 1000)

    def balance(self):
        return TokenWalletAccount.objects.get(wallet__owner=self.user).amount

    def bet(self, amount=100, difficulty="easy", hit=None):
        round_, _ = chicken.place_bet(self.user, amount, difficulty)
        ChickenRound.objects.filter(pk=round_.pk).update(hit_lane=hit)
        round_.refresh_from_db()
        return round_

    def test_bet_debits_and_hides_the_outcome(self):
        round_ = self.bet(100, "medium", hit=5)
        self.assertEqual(self.balance(), 900)
        payload = chicken.round_payload(round_)
        self.assertIsNone(payload["hit_lane"])
        self.assertIsNone(payload["server_seed"])
        self.assertEqual(payload["lanes"], 19)
        self.assertEqual(round_.server_seed_hash, fair.hash_seed(round_.server_seed))

    def test_bad_bets_are_refused(self):
        with self.assertRaises(rounds.CrashError):
            chicken.place_bet(self.user, 100, "insane")
        with self.assertRaises(rounds.CrashError):
            chicken.place_bet(self.user, 1001, "easy")
        self.bet()
        with self.assertRaises(rounds.CrashError):
            chicken.place_bet(self.user, 10, "easy")  # one round at a time
        self.assertEqual(self.balance(), 900)

    def test_steps_then_cash_out(self):
        round_ = self.bet(100, "easy", hit=10)
        for _ in range(3):
            round_ = chicken.step(self.user, round_.pk)
        self.assertEqual((round_.step, round_.status), (3, "active"))
        round_ = chicken.cash_out(self.user, round_.pk)
        expected = chicken.lane_multipliers(24, D("0.05"), D("0.02"))[2]
        self.assertEqual((round_.status, round_.cashout_multiplier), ("won", expected))
        self.assertEqual(round_.payout, int(100 * expected))
        self.assertEqual(self.balance(), 900 + round_.payout)
        again = chicken.cash_out(self.user, round_.pk)
        self.assertEqual(again.payout, round_.payout)
        self.assertEqual(self.balance(), 900 + round_.payout)

    def test_stepping_onto_the_hit_lane_loses_and_reveals(self):
        round_ = self.bet(100, "hard", hit=2)
        round_ = chicken.step(self.user, round_.pk)
        round_ = chicken.step(self.user, round_.pk)
        self.assertEqual((round_.step, round_.status, round_.payout), (2, "lost", 0))
        payload = chicken.round_payload(round_)
        self.assertEqual(payload["hit_lane"], 2)
        self.assertEqual(payload["server_seed"], round_.server_seed)
        self.assertEqual(self.balance(), 900)
        self.assertEqual(chicken.step(self.user, round_.pk).status, "lost")  # late click: no change

    def test_jump_stops_at_the_hit_lane(self):
        round_ = self.bet(100, "medium", hit=4)
        round_ = chicken.step(self.user, round_.pk, to=7)
        self.assertEqual((round_.step, round_.status), (4, "lost"))

    def test_jump_cashes_out_at_the_target(self):
        round_ = self.bet(100, "medium", hit=9)
        round_ = chicken.step(self.user, round_.pk, to=6)
        self.assertEqual((round_.step, round_.status), (6, "won"))
        self.assertEqual(round_.cashout_multiplier, chicken.multipliers_for(round_)[5])

    def test_go_max_crosses_everything_when_nothing_hits(self):
        round_ = self.bet(10, "easy", hit=None)
        round_ = chicken.step(self.user, round_.pk, to=24)
        self.assertEqual((round_.step, round_.status, round_.cashout_multiplier), (24, "won", D("3.35")))
        self.assertEqual(self.balance(), 990 + 33)

    def test_last_lane_cashes_out_by_itself(self):
        round_ = self.bet(10, "hard", hit=None)
        for _ in range(16):
            round_ = chicken.step(self.user, round_.pk)
        self.assertEqual((round_.step, round_.status), (16, "won"))

    def test_payout_cap_cashes_out(self):
        config = ChickenConfiguration.current()
        config.max_payout = 500
        config.save()
        round_ = self.bet(100, "hard", hit=None)  # 1.75, 3.12, 5.57…: lane 3 reaches 500
        round_ = chicken.step(self.user, round_.pk, to=10)
        self.assertEqual((round_.step, round_.status, round_.payout), (3, "won", 500))

    def test_cash_out_before_the_first_lane_is_refused(self):
        round_ = self.bet()
        with self.assertRaises(rounds.CrashError):
            chicken.cash_out(self.user, round_.pk)

    def test_bad_jump_target_is_refused(self):
        round_ = self.bet(100, "easy", hit=None)
        with self.assertRaises(rounds.CrashError):
            chicken.step(self.user, round_.pk, to=25)


@override_settings(CACHES=LOCMEM)
class ChickenApiTests(TestCase):
    def setUp(self):
        self.user = RoundTests.make_player("9120000401", 1000)
        self.other = RoundTests.make_player("9120000402", 1000)
        self.api = APIClient()
        self.api.force_authenticate(self.user)

    def result(self, response):
        return response.json()["result"]

    def test_config_lists_the_three_levels(self):
        config = self.result(self.api.get("/api/v1/games/chicken/config/"))
        self.assertEqual({k: v["lanes"] for k, v in config["difficulties"].items()}, {"easy": 24, "medium": 19, "hard": 16})
        self.assertEqual(config["balance"], 1000)

    def test_play_through_the_api(self):
        r = self.api.post("/api/v1/games/chicken/rounds/", {"bet": 100, "difficulty": "easy"}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        round_id = self.result(r)["round"]["id"]
        ChickenRound.objects.filter(pk=round_id).update(hit_lane=None)
        r = self.api.post(f"/api/v1/games/chicken/rounds/{round_id}/step/", {}, format="json")
        self.assertEqual(self.result(r)["round"]["step"], 1)
        r = self.api.post(f"/api/v1/games/chicken/rounds/{round_id}/cashout/")
        body = self.result(r)
        self.assertEqual(body["round"]["status"], "won")
        self.assertEqual(body["balance"], 900 + 103)
        self.assertEqual(self.result(self.api.get("/api/v1/games/chicken/rounds/"))["results"][0]["id"], round_id)

    def test_cannot_touch_another_players_round(self):
        round_, _ = chicken.place_bet(self.other, 100, "easy")
        r = self.api.post(f"/api/v1/games/chicken/rounds/{round_.pk}/step/", {}, format="json")
        self.assertEqual(r.status_code, 404)
        r = self.api.post(f"/api/v1/games/chicken/rounds/{round_.pk}/cashout/")
        self.assertEqual(r.status_code, 404)

    def test_wallet_history_lists_bet_and_win(self):
        round_, _ = chicken.place_bet(self.user, 100, "easy")
        ChickenRound.objects.filter(pk=round_.pk).update(hit_lane=None)
        chicken.step(self.user, round_.pk, to=2)
        rows = self.result(self.api.get("/api/v1/wallet/points/transactions/"))["results"]
        types = {row["type"] for row in rows}
        self.assertTrue({"chicken_bet", "chicken_win"} <= types, types)
