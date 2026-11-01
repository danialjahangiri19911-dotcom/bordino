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
        self.assertEqual(session["creative"], {"app_id": "ce7eba05-cd4e-4fa6-aa35-15ad352795ee", "placement_id": PLACEMENT})
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
