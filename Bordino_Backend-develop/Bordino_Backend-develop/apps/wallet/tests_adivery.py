from unittest import mock

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.configuration.models import SystemConfiguration
from apps.missions import services as missions
from apps.missions.models import Mission, MissionAttempt, MissionCategory
from apps.user_management.services.user.registration import UserRegistrationService
from apps.wallet.models import AdRewardSession, TokenWalletAccount
from apps.wallet.services import ad_reward

LOCMEM = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
PLACEMENT = "16414bae-368e-4904-b259-c5b89362206d"


def setting(key, value):
    SystemConfiguration.objects.update_or_create(key=key, defaults={"value": value})
    cache.clear()


@override_settings(CACHES=LOCMEM)
class AdiveryTests(TestCase):
    def setUp(self):
        cache.clear()
        self.user = get_user_model().objects.create_user(phone_number="9120009001")
        service = UserRegistrationService()
        service._create_customer_for_user(self.user)
        service._create_wallet_for_user(self.user)
        self.customer = self.user.customer
        setting("AD_REWARD_PROVIDER", "adivery")
        setting("ADIVERY_REWARDED_PLACEMENT_ID", PLACEMENT)
        setting("AD_REWARD_POINTS", "5")
        self.api = APIClient()
        self.api.force_authenticate(self.user)
        self.secret = ad_reward.adivery_callback_secret()

    def points(self):
        return TokenWalletAccount.objects.get(wallet__owner=self.user).amount

    def callback(self, uid, eid="ev-1", pid=PLACEMENT, secret=None):
        return APIClient().get(
            f"/api/v1/wallet/ad-reward/adivery/{secret or self.secret}/", {"uid": str(uid), "pid": pid, "eid": eid}
        )

    def start(self):
        answer = self.api.post("/api/v1/wallet/ad-reward/sessions/", {"placement": "sudoku"}, format="json").json()["result"]
        return answer

    def test_without_a_placement_nothing_is_offered(self):
        SystemConfiguration.objects.filter(key="ADIVERY_REWARDED_PLACEMENT_ID").delete()
        cache.clear()
        with mock.patch.dict(ad_reward.DEFAULTS, {"ADIVERY_REWARDED_PLACEMENT_ID": ""}):
            self.assertFalse(ad_reward.offer(self.customer).available)
        # Bordino's own placement is the default.
        self.assertTrue(ad_reward.offer(self.customer).available)

    def test_the_app_alone_cannot_claim_only_adiverys_server_confirms(self):
        session = self.start()
        self.assertEqual(session["provider"], "adivery")
        self.assertEqual(
            session["creative"],
            {"app_id": "ce7eba05-cd4e-4fa6-aa35-15ad352795ee", "placement_id": PLACEMENT, "user_ref": ad_reward.player_ref(self.customer)},
        )
        early = self.api.post(f"/api/v1/wallet/ad-reward/sessions/{session['session_id']}/complete/", {}, format="json")
        self.assertEqual((early.status_code, early.json()["errors"]["code"]), (409, "pending"))
        self.assertEqual(self.points(), 0)
        self.assertEqual(self.callback(session["session_id"], secret="x" * 40).status_code, 404)
        self.assertEqual(self.callback(session["session_id"], pid="other").status_code, 400)
        self.assertEqual(self.callback("not-a-uuid").status_code, 400)
        ok = self.callback(session["session_id"])
        self.assertEqual((ok.status_code, ok.json()["result"]["paid"]), (200, True))
        again = self.callback(session["session_id"])  # Adivery repeats the call
        self.assertTrue(again.json()["result"]["already"])
        claim = self.api.post(f"/api/v1/wallet/ad-reward/sessions/{session['session_id']}/complete/", {}, format="json")
        self.assertTrue(claim.json()["result"]["already_rewarded"])
        self.assertEqual(self.points(), 5)

    def test_until_adivery_calls_us_the_app_can_be_trusted_by_a_switch(self):
        from datetime import timedelta  # pylint: disable=import-outside-toplevel

        from django.utils import timezone  # pylint: disable=import-outside-toplevel

        session = self.start()
        url = f"/api/v1/wallet/ad-reward/sessions/{session['session_id']}/complete/"
        setting("ADIVERY_TRUST_APP", "true")
        self.assertEqual(self.api.post(url, {}, format="json").status_code, 409)  # too soon
        AdRewardSession.objects.filter(pk=session["session_id"]).update(create_time=timezone.now() - timedelta(seconds=6))
        self.assertEqual(self.api.post(url, {}, format="json").status_code, 200)
        self.assertEqual(self.points(), 5)
        # A late confirmation from Adivery changes nothing.
        self.assertTrue(self.callback(session["session_id"], eid="late").json()["result"]["already"])
        self.assertEqual(self.points(), 5)

    def test_a_failure_while_paying_asks_adivery_to_call_again_and_then_pays_once(self):
        from django.db import OperationalError  # pylint: disable=import-outside-toplevel

        session = self.start()
        with mock.patch.object(ad_reward, "complete", side_effect=OperationalError("db hiccup")):
            with self.assertRaises(OperationalError):
                ad_reward.adivery_callback(self.secret, session["session_id"], PLACEMENT, "e-r")
        self.assertEqual(self.points(), 0)
        again = self.callback(session["session_id"], eid="e-r")  # Adivery repeats the call
        self.assertEqual((again.status_code, again.json()["result"]["paid"]), (200, True))
        self.assertEqual(self.points(), 5)

    def test_one_event_pays_one_session(self):
        first, second = self.start(), self.start()
        self.callback(first["session_id"], eid="ev-9")
        self.assertEqual(self.callback(second["session_id"], eid="ev-9").status_code, 409)
        self.assertEqual(self.callback(first["session_id"], eid="ev-10").status_code, 409)
        self.assertEqual(self.points(), 5)

    def test_past_the_daily_limit_it_is_confirmed_but_not_paid(self):
        setting("AD_REWARD_DAILY_LIMIT", "1")
        first, second = self.start(), self.start()
        self.callback(first["session_id"], eid="a")
        late = self.callback(second["session_id"], eid="b")
        self.assertEqual((late.status_code, late.json()["result"]["paid"]), (200, False))
        self.assertEqual(self.points(), 5)
        self.assertIsNotNone(AdRewardSession.objects.get(pk=second["session_id"]).verified_at)

    def test_a_video_mission_is_paid_by_the_confirmation(self):
        category = MissionCategory.objects.create(name="ویدیو")
        mission = Mission.objects.create(
            title="ویدیو", category=category, kind=Mission.Kind.VIDEO, points=12, repeat=Mission.Repeat.DAILY, daily_limit=3
        )
        attempt = missions.start(self.customer, mission.pk)
        with self.assertRaises(missions.MissionError) as early:
            missions.claim(self.customer, attempt.pk)
        self.assertEqual(early.exception.code, "pending")
        self.callback(attempt.ad_session_id, eid="m-1")
        attempt.refresh_from_db()
        self.assertEqual(attempt.status, MissionAttempt.Status.COMPLETED)
        self.assertEqual(self.points(), 12)
        self.assertTrue(missions.claim(self.customer, attempt.pk).already)

    def test_the_admin_shows_the_callback_address_to_superusers_only(self):
        from django.contrib.auth.models import Permission  # pylint: disable=import-outside-toplevel

        url = "/admin/wallet/adrewardsession/"
        staff = get_user_model().objects.create_user(phone_number="9120009002", password="x-Pass-123")
        staff.is_admin = True
        staff.save()
        staff.user_permissions.add(Permission.objects.get(codename="view_adrewardsession"))
        self.client.force_login(staff)
        self.assertNotIn(self.secret, self.client.get(url).content.decode())
        boss = get_user_model().objects.create_superuser(phone_number="9120009003", password="x-Pass-123")
        self.client.force_login(boss)
        self.assertIn(f"/api/v1/wallet/ad-reward/adivery/{self.secret}/", self.client.get(url).content.decode())

    def test_the_callback_address_command(self):
        from io import StringIO  # pylint: disable=import-outside-toplevel

        from django.core.management import call_command  # pylint: disable=import-outside-toplevel

        out = StringIO()
        call_command("adivery_callback_url", stdout=out)
        self.assertTrue(out.getvalue().strip().endswith(f"/api/v1/wallet/ad-reward/adivery/{self.secret}/"))

    def test_an_admin_change_of_the_provider_applies_at_once(self):
        import gc  # pylint: disable=import-outside-toplevel

        gc.collect()  # the save's cache clearing must survive a garbage collection
        self.assertEqual(ad_reward.provider().name, "adivery")  # read: now cached
        row = SystemConfiguration.objects.get_queryset().get(key="AD_REWARD_PROVIDER")
        row.value = "demo"
        row.save()  # as the admin saves it, with no cache.clear()
        self.assertEqual(ad_reward.provider().name, "demo")
        row.delete()
        self.assertEqual(ad_reward.provider().name, "demo")  # the built-in default again


@override_settings(CACHES=LOCMEM)
class AdiveryPlayerRefTests(TestCase):
    """The SDK sends the id it held when the ad was LOADED (ahead of the tap): the player's signed
    reference, matched to their latest view still waiting for Adivery."""

    def setUp(self):
        cache.clear()
        setting("AD_REWARD_PROVIDER", "adivery")
        setting("ADIVERY_REWARDED_PLACEMENT_ID", PLACEMENT)
        setting("AD_REWARD_POINTS", "5")
        self.secret = ad_reward.adivery_callback_secret()
        self.customer, self.user = self.player("9120009101")

    def player(self, phone):
        user = get_user_model().objects.create_user(phone_number=phone)
        service = UserRegistrationService()
        service._create_customer_for_user(user)  # pylint: disable=protected-access
        service._create_wallet_for_user(user)  # pylint: disable=protected-access
        return user.customer, user

    def points(self, user=None):
        return TokenWalletAccount.objects.get(wallet__owner=user or self.user).amount

    def callback(self, uid, eid, pid=PLACEMENT):
        return APIClient().get(f"/api/v1/wallet/ad-reward/adivery/{self.secret}/", {"uid": uid, "pid": pid, "eid": eid})

    def test_the_offer_and_the_view_carry_the_players_reference(self):
        ref = ad_reward.player_ref(self.customer)
        self.assertRegex(ref, r"^[0-9a-f]{32}-[0-9a-f]{16}$")
        self.assertEqual(ad_reward.offer(self.customer).creative["user_ref"], ref)
        other, _ = self.player("9120009102")
        self.assertNotEqual(ad_reward.player_ref(other), ref)

    def test_a_confirmation_pays_the_players_latest_waiting_view_once(self):
        from datetime import timedelta  # pylint: disable=import-outside-toplevel

        from django.utils import timezone  # pylint: disable=import-outside-toplevel

        left = ad_reward.start(self.customer, "sudoku")  # opened, never watched
        AdRewardSession.objects.filter(pk=left.pk).update(create_time=timezone.now() - timedelta(minutes=5))
        watched = ad_reward.start(self.customer, "game2048")
        ref = ad_reward.player_ref(self.customer)
        ok = self.callback(ref, "ev-p1")
        self.assertEqual((ok.status_code, ok.json()["result"]["paid"]), (200, True))
        watched.refresh_from_db()
        self.assertEqual((watched.status, watched.external_event_id), (AdRewardSession.Status.REWARDED, "ev-p1"))
        self.assertIsNone(AdRewardSession.objects.get(pk=left.pk).verified_at)
        again = self.callback(ref, "ev-p1")  # Adivery repeats it: the same view, nothing more
        self.assertTrue(again.json()["result"]["already"])
        self.assertEqual(self.points(), 5)
        # Another event pays the next waiting view (the left one, still within its time) — once.
        self.assertEqual(self.callback(ref, "ev-p2").json()["result"]["paid"], True)
        self.assertEqual(self.points(), 10)
        self.assertEqual(self.callback(ref, "ev-p3").status_code, 404)  # nothing waits any more
        self.assertEqual(self.points(), 10)

    def test_an_expired_view_is_not_matched(self):
        from datetime import timedelta  # pylint: disable=import-outside-toplevel

        from django.utils import timezone  # pylint: disable=import-outside-toplevel

        old = ad_reward.start(self.customer, "sudoku")
        AdRewardSession.objects.filter(pk=old.pk).update(create_time=timezone.now() - ad_reward.SESSION_TTL - timedelta(seconds=1))
        self.assertEqual(self.callback(ad_reward.player_ref(self.customer), "ev-old").status_code, 404)
        self.assertEqual(self.points(), 0)

    def test_a_forged_or_borrowed_reference_pays_nobody(self):
        ad_reward.start(self.customer, "sudoku")
        ref = ad_reward.player_ref(self.customer)
        forged = ref[:-1] + ("0" if ref[-1] != "0" else "1")
        self.assertEqual(self.callback(forged, "ev-f").status_code, 400)
        other, other_user = self.player("9120009103")
        ad_reward.start(other, "sudoku")
        self.assertEqual(self.callback(ref, "ev-shared").status_code, 200)
        # The same event cannot be used for another player's view.
        self.assertEqual(self.callback(ad_reward.player_ref(other), "ev-shared").status_code, 409)
        self.assertEqual((self.points(), self.points(other_user)), (5, 0))

    def test_a_view_the_app_was_trusted_for_is_confirmed_without_paying_again(self):
        from datetime import timedelta  # pylint: disable=import-outside-toplevel

        from django.utils import timezone  # pylint: disable=import-outside-toplevel

        setting("ADIVERY_TRUST_APP", "true")
        session = ad_reward.start(self.customer, "sudoku")
        AdRewardSession.objects.filter(pk=session.pk).update(create_time=timezone.now() - timedelta(seconds=6))
        ad_reward.complete(self.customer, session.pk)
        self.assertEqual(self.points(), 5)
        late = self.callback(ad_reward.player_ref(self.customer), "ev-t")
        self.assertEqual((late.status_code, late.json()["result"]["already"]), (200, True))
        session.refresh_from_db()
        self.assertEqual(session.external_event_id, "ev-t")
        self.assertEqual(self.points(), 5)

    def test_a_video_mission_is_paid_by_the_players_reference(self):
        category = MissionCategory.objects.create(name="ویدیو")
        mission = Mission.objects.create(
            title="ویدیو", category=category, kind=Mission.Kind.VIDEO, points=12, repeat=Mission.Repeat.DAILY, daily_limit=3
        )
        attempt = missions.start(self.customer, mission.pk)
        self.assertEqual(self.callback(ad_reward.player_ref(self.customer), "m-ref").status_code, 200)
        attempt.refresh_from_db()
        self.assertEqual(attempt.status, MissionAttempt.Status.COMPLETED)
        self.assertEqual(self.points(), 12)


@override_settings(CACHES=LOCMEM)
class AdiveryCallbackAttemptTests(AdiveryTests):
    """Every call to the confirmation address is recorded, whatever it says (and never its secret)."""

    def test_each_call_is_recorded_with_what_it_sent_and_how_it_was_answered(self):
        from apps.wallet.models import AdiveryCallbackAttempt  # pylint: disable=import-outside-toplevel

        session = self.start()
        self.callback(session["session_id"], secret="x" * 40)
        self.callback(session["session_id"], pid="other")
        self.callback(session["session_id"])
        self.callback(session["session_id"])
        # A caller using other parameter names (and a body): the names are what tells.
        APIClient().post(f"/api/v1/wallet/ad-reward/adivery/{self.secret}/?user_id=abc", {"event_id": "e9", "placement": "p"}, format="json")
        rows = list(AdiveryCallbackAttempt.objects.order_by("create_time").values_list("method", "secret_ok", "outcome", "http_status", "message"))
        self.assertEqual(
            rows,
            [
                ("GET", False, "refused", 404, "not found"),
                ("GET", True, "refused", 400, "unknown placement"),
                ("GET", True, "paid", 200, ""),
                ("GET", True, "already", 200, ""),
                ("POST", True, "refused", 400, "bad event id"),
            ],
        )
        last = AdiveryCallbackAttempt.objects.order_by("-create_time").first()
        self.assertEqual(last.params, {"user_id": "abc", "event_id": "e9", "placement": "p"})
        paid = AdiveryCallbackAttempt.objects.get(outcome="paid")
        self.assertEqual((paid.session_ref, paid.params["eid"], paid.params["pid"]), (session["session_id"], "ev-1", PLACEMENT))
        # The address's secret is never stored.
        for row in AdiveryCallbackAttempt.objects.all():
            self.assertNotIn(self.secret, str(row.params) + row.message + row.session_ref)

    def test_a_failure_to_record_never_breaks_the_callback(self):
        from apps.wallet.models import AdiveryCallbackAttempt  # pylint: disable=import-outside-toplevel

        session = self.start()
        with mock.patch.object(AdiveryCallbackAttempt.objects, "create", side_effect=RuntimeError("db full")):
            ok = self.callback(session["session_id"])
        self.assertEqual((ok.status_code, ok.json()["result"]["paid"]), (200, True))
        self.assertEqual(self.points(), 5)

    def test_the_address_works_without_its_last_slash_too(self):
        from apps.wallet.models import AdiveryCallbackAttempt  # pylint: disable=import-outside-toplevel

        first, second = self.start(), self.start()
        url = f"/api/v1/wallet/ad-reward/adivery/{self.secret}"
        got = APIClient().get(url, {"uid": first["session_id"], "pid": PLACEMENT, "eid": "ns-1"})
        self.assertEqual((got.status_code, got.json()["result"]["paid"]), (200, True))
        posted = APIClient().post(f"{url}?uid={second['session_id']}&pid={PLACEMENT}&eid=ns-2")
        self.assertEqual((posted.status_code, posted.json()["result"]["paid"]), (200, True))
        self.assertEqual(self.points(), 10)
        self.assertEqual(APIClient().get("/api/v1/wallet/ad-reward/adivery/" + "x" * 40).status_code, 404)
        self.assertEqual(AdiveryCallbackAttempt.objects.filter(outcome="paid").count(), 2)



class AdiverySecretTests(TestCase):
    def test_the_secret_in_the_address_never_reaches_a_log(self):
        import logging  # pylint: disable=import-outside-toplevel

        from main_app.log_redaction import RedactSecrets, install  # pylint: disable=import-outside-toplevel

        install()
        secret = "0123456789abcdef0123456789abcdef01234567"
        for name in ("uvicorn.access", "django.request"):
            record = logging.LogRecord(name, logging.INFO, __file__, 1, '%s - "GET %s HTTP/1.1" %d', ("1.2.3.4:5", f"/api/v1/wallet/ad-reward/adivery/{secret}/?uid=x", 200), None)
            self.assertTrue(RedactSecrets().filter(record))
            self.assertNotIn(secret, record.getMessage())
            self.assertIn("adivery/<secret>/", record.getMessage())
        self.assertTrue(any(isinstance(f, RedactSecrets) for f in logging.getLogger("uvicorn.access").filters))

    def test_the_secret_can_be_rotated_by_the_environment(self):
        import os  # pylint: disable=import-outside-toplevel
        from unittest import mock  # pylint: disable=import-outside-toplevel

        derived = ad_reward.adivery_callback_secret()
        with mock.patch.dict(os.environ, {"ADIVERY_CALLBACK_SECRET": "r" * 40}):
            self.assertEqual(ad_reward.adivery_callback_secret(), "r" * 40)
        with mock.patch.dict(os.environ, {"ADIVERY_CALLBACK_SECRET": "short"}):
            self.assertEqual(ad_reward.adivery_callback_secret(), derived)  # (too weak: the derived one stays)


class AdiveryRedactionShapeTests(TestCase):
    def test_masking_keeps_the_records_arguments_for_formatters_that_unpack_them(self):
        import logging  # pylint: disable=import-outside-toplevel

        from main_app.log_redaction import RedactSecrets  # pylint: disable=import-outside-toplevel

        secret = "0123456789abcdef0123456789abcdef01234567"
        args = ("1.2.3.4:5", "GET", f"/api/v1/wallet/ad-reward/adivery/{secret}/?uid=x", "1.1", 200)
        record = logging.LogRecord("uvicorn.access", logging.INFO, __file__, 1, '%s - "%s %s HTTP/%s" %d', args, None)
        RedactSecrets().filter(record)
        client, method, path, version, status = record.args  # (as uvicorn's AccessFormatter does)
        self.assertEqual((client, method, version, status), ("1.2.3.4:5", "GET", "1.1", 200))
        self.assertNotIn(secret, path)
        self.assertNotIn(secret, record.getMessage())
