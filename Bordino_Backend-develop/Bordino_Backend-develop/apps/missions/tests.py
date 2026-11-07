import io
import tempfile
import threading
import uuid
from datetime import timedelta
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import connection
from django.test import TestCase, TransactionTestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.missions import services
from apps.missions.models import Mission, MissionAttempt, MissionCategory
from apps.user_management.services.user.registration import UserRegistrationService
from apps.wallet.models import AdRewardSession, TokenWalletAccount
from apps.wallet.models.transactions.activity import ActivityTransaction
from apps.wallet.services.history import points_history

LOCMEM = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
MEDIA = tempfile.mkdtemp(prefix="missions-test-")


def make_player(phone, points=0):
    user = get_user_model().objects.create_user(phone_number=phone)
    service = UserRegistrationService()
    service._create_customer_for_user(user)
    service._create_wallet_for_user(user)
    TokenWalletAccount.objects.filter(wallet__owner=user).update(amount=points)
    return user


def png(size=(4, 4)):
    from PIL import Image  # pylint: disable=import-outside-toplevel

    data = io.BytesIO()
    Image.new("RGB", size, "red").save(data, "PNG")
    return SimpleUploadedFile("proof.png", data.getvalue(), content_type="image/png")


@override_settings(CACHES=LOCMEM, MEDIA_ROOT=__import__("pathlib").Path(MEDIA))
class MissionTests(TestCase):
    def setUp(self):
        cache.clear()  # settings (the daily video limit) are cached: none from another test
        self.user = make_player("9120007001")
        self.customer = self.user.customer
        self.cat = MissionCategory.objects.create(name="تبلیغات")

    def mission(self, **kw):
        defaults = {
            "title": "بنر کافه",
            "category": self.cat,
            "kind": Mission.Kind.BANNER,
            "points": 7,
            "link_url": "https://example.com/",
            "min_seconds": 10,
        }
        defaults.update(kw)
        return Mission.objects.create(**defaults)

    def points(self):
        return TokenWalletAccount.objects.get(wallet__owner=self.user).amount

    def state(self, mission):
        return next(v for v in services.listing(self.customer) if v.mission.pk == mission.pk).state

    def age(self, attempt, seconds):
        """The try was started and its link opened `seconds` ago."""
        then = timezone.now() - timedelta(seconds=seconds)
        MissionAttempt.objects.filter(pk=attempt.pk).update(create_time=then, opened_at=then)

    # ── kinds and their checks ──

    def test_kind_and_verification_must_match(self):
        with self.assertRaises(ValidationError):
            self.mission(kind=Mission.Kind.SIGNUP, verification=Mission.Verification.AUTO)
        with self.assertRaises(ValidationError):
            self.mission(kind=Mission.Kind.BANNER, verification=Mission.Verification.REVIEW)
        with self.assertRaises(ValidationError):
            self.mission(kind=Mission.Kind.SIGNUP, verification=Mission.Verification.CALLBACK, link_url="https://p.ir/")
        qr = self.mission(kind=Mission.Kind.QR, link_url="")
        self.assertTrue(qr.qr_token)

    def test_banner_pays_after_the_wait_once(self):
        m = self.mission()
        self.assertEqual(self.state(m), "available")
        attempt = services.start(self.customer, m.pk)
        self.assertEqual(self.state(m), "in_progress")
        MissionAttempt.objects.filter(pk=attempt.pk).update(create_time=timezone.now() - timedelta(minutes=5))
        with self.assertRaises(services.MissionError) as unopened:
            services.claim(self.customer, attempt.pk)  # waited, but never opened the banner
        self.assertEqual(unopened.exception.code, "not_opened")
        services.mark_opened(self.customer, attempt.pk)
        with self.assertRaises(services.MissionError) as too_soon:
            services.claim(self.customer, attempt.pk)
        self.assertEqual(too_soon.exception.code, "too_soon")
        self.age(attempt, 11)
        self.assertFalse(services.claim(self.customer, attempt.pk).already)
        self.assertTrue(services.claim(self.customer, attempt.pk).already)
        self.assertEqual(self.points(), 7)
        self.assertEqual(self.state(m), "done")
        with self.assertRaises(services.MissionError):
            services.start(self.customer, m.pk)

    def test_daily_mission_counts_per_day(self):
        m = self.mission(repeat=Mission.Repeat.DAILY, daily_limit=2)
        for _ in range(2):
            attempt = services.start(self.customer, m.pk)
            self.age(attempt, 11)
            services.claim(self.customer, attempt.pk)
        self.assertEqual(self.state(m), "done_today")
        with self.assertRaises(services.MissionError) as full:
            services.start(self.customer, m.pk)
        self.assertEqual(full.exception.code, "done_today")
        MissionAttempt.objects.update(day=timezone.localdate() - timedelta(days=1))
        self.assertEqual(self.state(m), "available")
        self.assertEqual(self.points(), 14)

    def test_states_of_unavailable_missions(self):
        now = timezone.now()
        self.assertEqual(self.state(self.mission(is_active=False)), "inactive")
        self.assertEqual(self.state(self.mission(starts_at=now + timedelta(days=1))), "upcoming")
        self.assertEqual(self.state(self.mission(starts_at=now - timedelta(days=3), ends_at=now - timedelta(days=1))), "expired")
        full = self.mission(capacity=1)
        other = make_player("9120007002").customer
        attempt = services.start(other, full.pk)
        self.age(attempt, 11)
        services.claim(other, attempt.pk)
        self.assertEqual(self.state(full), "full")
        with self.assertRaises(services.MissionError):
            services.start(self.customer, full.pk)
        hidden = self.mission(is_visible=False)
        old = self.mission(ends_at=now - timedelta(days=30), starts_at=now - timedelta(days=40))
        shown = {v.mission.pk for v in services.listing(self.customer)}
        self.assertNotIn(hidden.pk, shown)
        self.assertNotIn(old.pk, shown)
        with self.assertRaises(services.NotFound):
            services.start(self.customer, hidden.pk)

    def test_inactive_category_hides_its_missions(self):
        m = self.mission()
        MissionCategory.objects.filter(pk=self.cat.pk).update(is_active=False)
        self.assertNotIn(m.pk, {v.mission.pk for v in services.listing(self.customer)})

    # ── review ──

    def review_mission(self, **kw):
        return self.mission(
            title="ثبت‌نام در میلی",
            kind=Mission.Kind.SIGNUP,
            verification=Mission.Verification.REVIEW,
            link_url="https://mili.example/",
            proof_label="شماره موبایلی که ثبت‌نام کردی",
            points=50,
            **kw,
        )

    def test_review_flow_approve_pays_and_reject_allows_a_retry(self):
        m = self.review_mission(proof_image_required=True)
        attempt = services.start(self.customer, m.pk)
        self.assertEqual(services.link_for(attempt), "https://mili.example/")
        with self.assertRaises(services.MissionError):
            services.submit_proof(self.customer, attempt.pk, "", png())
        with self.assertRaises(services.MissionError):
            services.submit_proof(self.customer, attempt.pk, "09120000000", None)
        services.submit_proof(self.customer, attempt.pk, "09120000000", png())
        self.assertEqual(self.state(m), "pending")
        with self.assertRaises(services.MissionError):
            services.start(self.customer, m.pk)  # a pending try holds the only slot
        self.assertTrue(services.reject(attempt.pk, note="شماره پیدا نشد"))
        self.assertFalse(services.reject(attempt.pk))
        self.assertEqual(self.state(m), "rejected")
        self.assertEqual(self.points(), 0)
        retry = services.start(self.customer, m.pk)
        self.assertNotEqual(retry.pk, attempt.pk)
        services.submit_proof(self.customer, retry.pk, "09120000000", png())
        self.assertTrue(services.approve(retry.pk))
        self.assertFalse(services.approve(retry.pk))
        self.assertEqual(self.points(), 50)
        self.assertEqual(self.state(m), "done")

    def test_proof_must_be_a_real_image(self):
        m = self.review_mission()
        attempt = services.start(self.customer, m.pk)
        broken = bytearray(png((64, 64)).read())
        idat = broken.index(b"IDAT")
        broken[idat + 10] ^= 0xFF  # a damaged picture: refused, not a server error
        with self.assertRaises(services.MissionError):
            services.submit_proof(self.customer, attempt.pk, "0912", SimpleUploadedFile("p.png", bytes(broken), content_type="image/png"))
        fake = SimpleUploadedFile("x.png", b"not an image", content_type="image/png")
        with self.assertRaises(services.MissionError):
            services.submit_proof(self.customer, attempt.pk, "0912", fake)
        big = SimpleUploadedFile("x.png", b"0" * (services.PROOF_MAX_BYTES + 1), content_type="image/png")
        with self.assertRaises(services.MissionError):
            services.submit_proof(self.customer, attempt.pk, "0912", big)

    def test_proof_is_stored_by_what_it_really_is(self):
        m = self.review_mission()
        attempt = services.start(self.customer, m.pk)
        disguised = png()
        disguised.name = "evil.html"
        services.submit_proof(self.customer, attempt.pk, "0912", disguised)
        attempt.refresh_from_db()
        self.assertTrue(attempt.proof_image.name.endswith(".png"), attempt.proof_image.name)

    def test_a_try_under_review_leaves_the_rest_of_the_day_open(self):
        m = self.review_mission(repeat=Mission.Repeat.DAILY, daily_limit=2)
        first = services.start(self.customer, m.pk)
        services.submit_proof(self.customer, first.pk, "0912", None)
        self.assertEqual(self.state(m), "available")
        second = services.start(self.customer, m.pk)
        services.submit_proof(self.customer, second.pk, "0913", None)
        self.assertEqual(self.state(m), "pending")

    def test_kind_cannot_change_once_players_started(self):
        m = self.review_mission()
        services.start(self.customer, m.pk)
        m.kind = Mission.Kind.BANNER
        m.verification = Mission.Verification.AUTO
        with self.assertRaises(ValidationError):
            m.save()
        m.refresh_from_db()
        m.points = 60  # other fields still change
        m.save()

    def test_start_continues_an_open_try(self):
        m = self.review_mission()
        self.assertEqual(services.start(self.customer, m.pk).pk, services.start(self.customer, m.pk).pk)

    # ── partner callback ──

    def callback_mission(self):
        return self.mission(
            title="نصب والکس",
            kind=Mission.Kind.INSTALL,
            verification=Mission.Verification.CALLBACK,
            link_url="https://wallex.example/?ref=bordino&click_id={click_id}",
            points=30,
        )

    def test_partner_callback_pays_once_with_the_right_secret(self):
        m = self.callback_mission()
        self.assertTrue(m.callback_secret)
        attempt = services.start(self.customer, m.pk)
        self.assertIn(str(attempt.click_id), services.link_for(attempt))
        self.assertEqual(self.state(m), "waiting")
        with self.assertRaises(services.MissionError) as wrong:
            services.partner_callback(m.pk, attempt.click_id, "nope")
        self.assertEqual(wrong.exception.code, "forbidden")
        with self.assertRaises(services.NotFound):
            services.partner_callback(m.pk, uuid.uuid4(), m.callback_secret)
        with self.assertRaises(services.MissionError):
            services.partner_callback(m.pk, "not-a-uuid", m.callback_secret)
        self.assertFalse(services.partner_callback(m.pk, attempt.click_id, m.callback_secret).already)
        self.assertTrue(services.partner_callback(m.pk, attempt.click_id, m.callback_secret).already)
        self.assertEqual(self.points(), 30)
        self.assertEqual(self.state(m), "done")

    def test_callback_never_pays_past_the_capacity(self):
        m = self.callback_mission()
        Mission.objects.filter(pk=m.pk).update(capacity=1)
        m.refresh_from_db()
        first = services.start(self.customer, m.pk)
        other = make_player("9120007005").customer
        second = services.start(other, m.pk)
        services.partner_callback(m.pk, first.click_id, m.callback_secret)
        with self.assertRaises(services.MissionError) as full:
            services.partner_callback(m.pk, second.click_id, m.callback_secret)
        self.assertEqual(full.exception.code, "full")
        self.assertEqual(MissionAttempt.objects.filter(mission=m, status="completed").count(), 1)

    def test_a_non_ascii_secret_is_refused_not_a_crash(self):
        m = self.callback_mission()
        attempt = services.start(self.customer, m.pk)
        response = APIClient().get(f"/api/v1/missions/callback/{m.pk}/", {"click_id": str(attempt.click_id), "secret": "غلط"})
        self.assertEqual(response.status_code, 403)

    def test_callback_api(self):
        m = self.callback_mission()
        attempt = services.start(self.customer, m.pk)
        api = APIClient()
        url = f"/api/v1/missions/callback/{m.pk}/"
        self.assertEqual(api.get(url, {"click_id": str(attempt.click_id), "secret": "x"}).status_code, 403)
        self.assertEqual(api.get(url, {"click_id": "bad", "secret": m.callback_secret}).status_code, 400)
        ok = api.post(url, {"click_id": str(attempt.click_id), "secret": m.callback_secret}, format="json")
        self.assertEqual(ok.status_code, 200)
        self.assertEqual(self.points(), 30)

    # ── QR ──

    def test_qr_pays_once_and_works_while_hidden(self):
        m = self.mission(title="کافه بردینو", kind=Mission.Kind.QR, link_url="", points=20, is_visible=False)
        self.assertFalse(services.claim_qr(self.customer, m.qr_token).already)
        self.assertTrue(services.claim_qr(self.customer, m.qr_token).already)
        self.assertEqual(self.points(), 20)
        with self.assertRaises(services.NotFound):
            services.claim_qr(self.customer, "wrong-token")
        Mission.objects.filter(pk=m.pk).update(is_active=False)
        other = make_player("9120007003").customer
        with self.assertRaises(services.MissionError):
            services.claim_qr(other, m.qr_token)
        with self.assertRaises(services.NotFound):
            services.start(self.customer, m.pk)  # a QR is only claimed by its code

    # ── video ──

    def test_video_mission_pays_its_own_points_after_the_video(self):
        m = self.mission(title="ویدیو", kind=Mission.Kind.VIDEO, link_url="", points=9, repeat=Mission.Repeat.DAILY, daily_limit=3)
        attempt = services.start(self.customer, m.pk)
        self.assertEqual(attempt.ad_session.reward_points, 9)
        with self.assertRaises(services.MissionError):
            services.claim(self.customer, attempt.pk)
        AdRewardSession.objects.filter(pk=attempt.ad_session_id).update(create_time=timezone.now() - timedelta(seconds=60))
        services.claim(self.customer, attempt.pk)
        self.assertEqual(self.points(), 9)
        attempt.refresh_from_db()
        self.assertEqual(attempt.activity_transaction.section, "rewarded_ad")

    def test_a_mission_video_is_not_paid_through_the_plain_ad_endpoint(self):
        m = self.mission(title="ویدیو", kind=Mission.Kind.VIDEO, link_url="", points=40, repeat=Mission.Repeat.DAILY, daily_limit=1)
        attempt = services.start(self.customer, m.pk)
        AdRewardSession.objects.filter(pk=attempt.ad_session_id).update(create_time=timezone.now() - timedelta(seconds=60))
        api = APIClient()
        api.force_authenticate(self.user)
        refused = api.post(f"/api/v1/wallet/ad-reward/sessions/{attempt.ad_session_id}/complete/", {}, format="json")
        self.assertEqual(refused.status_code, 409)
        self.assertEqual(self.points(), 0)
        services.claim(self.customer, attempt.pk)
        self.assertEqual(self.points(), 40)

    def test_video_mission_follows_the_daily_video_limit(self):
        from apps.configuration.models import SystemConfiguration  # pylint: disable=import-outside-toplevel

        SystemConfiguration.objects.update_or_create(key="AD_REWARD_DAILY_LIMIT", defaults={"value": "1"})
        m = self.mission(title="ویدیو", kind=Mission.Kind.VIDEO, link_url="", points=9, repeat=Mission.Repeat.DAILY, daily_limit=3)
        attempt = services.start(self.customer, m.pk)
        AdRewardSession.objects.filter(pk=attempt.ad_session_id).update(create_time=timezone.now() - timedelta(seconds=60))
        services.claim(self.customer, attempt.pk)
        self.assertEqual(self.state(m), "done_today")
        with self.assertRaises(services.MissionError):
            services.start(self.customer, m.pk)

    # ── API and history ──

    def test_api_flow_and_history_title(self):
        api = APIClient()
        api.force_authenticate(self.user)
        m = self.mission()
        empty = MissionCategory.objects.create(name="خالی")
        body = api.get("/api/v1/missions/").json()["result"]
        self.assertEqual([c["id"] for c in body["categories"]], [str(self.cat.pk)])
        self.assertNotIn(str(empty.pk), [c["id"] for c in body["categories"]])
        self.assertEqual(body["missions"][0]["state"], "available")
        self.assertIsNone(body["missions"][0]["attempt"])
        started = api.post(f"/api/v1/missions/{m.pk}/start/").json()["result"]["mission"]
        self.assertEqual(started["attempt"]["link"], "https://example.com/")
        self.assertGreater(started["attempt"]["claim_in"], 0)
        attempt_id = started["attempt"]["id"]
        self.assertEqual(api.post(f"/api/v1/missions/attempts/{attempt_id}/claim/").status_code, 409)
        self.assertEqual(api.post(f"/api/v1/missions/attempts/{attempt_id}/opened/").status_code, 200)
        MissionAttempt.objects.filter(pk=attempt_id).update(opened_at=timezone.now() - timedelta(seconds=30))
        done = api.post(f"/api/v1/missions/attempts/{attempt_id}/claim/").json()["result"]
        self.assertEqual((done["points"], done["points_balance"], done["mission"]["state"]), (7, 7, "done"))
        tx = ActivityTransaction.objects.get(section="mission")
        self.assertEqual(tx.metadata["title"], "بنر کافه")
        self.assertTrue(any(r["title"] == "مأموریت: بنر کافه" for r in points_history(self.user)))

    def test_proof_api_with_upload_and_another_players_try(self):
        m = self.review_mission(proof_image_required=True)
        api = APIClient()
        api.force_authenticate(self.user)
        started = api.post(f"/api/v1/missions/{m.pk}/start/").json()["result"]["mission"]
        attempt_id = started["attempt"]["id"]
        intruder = APIClient()
        intruder.force_authenticate(make_player("9120007004"))
        self.assertEqual(intruder.post(f"/api/v1/missions/attempts/{attempt_id}/proof/", {"text": "x"}).status_code, 404)
        sent = api.post(f"/api/v1/missions/attempts/{attempt_id}/proof/", {"text": "0912", "image": png()}, format="multipart")
        self.assertEqual(sent.status_code, 200)
        self.assertEqual(sent.json()["result"]["mission"]["state"], "pending")
        attempt = MissionAttempt.objects.get(pk=attempt_id)
        self.assertTrue(attempt.proof_image.name.startswith("mission-proofs/"))
        self.assertIn("private", attempt.proof_image.path)

    def test_qr_api(self):
        m = self.mission(kind=Mission.Kind.QR, link_url="", points=20)
        api = APIClient()
        self.assertEqual(api.post(f"/api/v1/missions/qr/{m.qr_token}/").status_code, 401)
        api.force_authenticate(self.user)
        first = api.post(f"/api/v1/missions/qr/{m.qr_token}/").json()["result"]
        self.assertEqual((first["already_rewarded"], first["points"], first["title"]), (False, 20, "بنر کافه"))
        self.assertTrue(api.post(f"/api/v1/missions/qr/{m.qr_token}/").json()["result"]["already_rewarded"])
        self.assertEqual(api.post("/api/v1/missions/qr/nope/").status_code, 404)

    # ── admin ──

    def test_admin_approves_and_shows_the_proof_to_staff_only(self):
        m = self.review_mission(proof_image_required=True)
        attempt = services.start(self.customer, m.pk)
        services.submit_proof(self.customer, attempt.pk, "0912", png())
        staff = get_user_model().objects.create_superuser(phone_number="9120007099", password="x-Pass-123")
        api = APIClient()
        proof_url = f"/admin/missions/missionattempt/{attempt.pk}/proof/"
        self.assertNotEqual(api.get(proof_url).status_code, 200)
        self.client.force_login(staff)
        shown = self.client.get(proof_url)
        self.assertEqual((shown.status_code, shown["Content-Type"]), (200, "image/png"))
        self.assertIn("sandbox", shown["Content-Security-Policy"])
        with mock.patch("apps.notifications.services.queue") as queued:
            response = self.client.post(
                "/admin/missions/missionattempt/",
                {"action": "approve_selected", "_selected_action": [str(attempt.pk)]},
            )
        self.assertEqual(response.status_code, 302)
        self.assertEqual(self.points(), 50)
        self.assertTrue(queued.called)

    def test_view_only_staff_cannot_approve(self):
        from django.contrib.auth.models import Permission  # pylint: disable=import-outside-toplevel

        m = self.review_mission()
        attempt = services.start(self.customer, m.pk)
        services.submit_proof(self.customer, attempt.pk, "0912", None)
        viewer = get_user_model().objects.create_user(phone_number="9120007097", password="x-Pass-123")
        viewer.is_admin = True  # staff (is_staff follows is_admin), not a superuser
        viewer.save()
        viewer.user_permissions.add(Permission.objects.get(codename="view_missionattempt"))
        self.client.force_login(viewer)
        self.client.post("/admin/missions/missionattempt/", {"action": "approve_selected", "_selected_action": [str(attempt.pk)]})
        attempt.refresh_from_db()
        self.assertEqual((attempt.status, self.points()), ("pending", 0))

    def test_view_only_staff_never_see_the_partner_key(self):
        from django.contrib.auth.models import Permission  # pylint: disable=import-outside-toplevel

        m = self.callback_mission()
        viewer = get_user_model().objects.create_user(phone_number="9120007096", password="x-Pass-123")
        viewer.is_admin = True
        viewer.save()
        viewer.user_permissions.add(Permission.objects.get(codename="view_mission"))
        self.client.force_login(viewer)
        page = self.client.get(f"/admin/missions/mission/{m.pk}/change/")
        self.assertEqual(page.status_code, 200)
        self.assertNotIn(m.callback_secret, page.content.decode())
        staff = get_user_model().objects.create_superuser(phone_number="9120007095", password="x-Pass-123")
        self.client.force_login(staff)
        self.assertIn(m.callback_secret, self.client.get(f"/admin/missions/mission/{m.pk}/change/").content.decode())

    def test_a_broken_unicode_secret_is_refused(self):
        m = self.callback_mission()
        attempt = services.start(self.customer, m.pk)
        with self.assertRaises(services.MissionError) as refused:
            services.partner_callback(m.pk, attempt.click_id, "\ud800")
        self.assertEqual(refused.exception.code, "forbidden")

    def test_pending_tries_are_counted(self):
        m = self.review_mission(repeat=Mission.Repeat.DAILY, daily_limit=2)
        for text in ("0912", "0913"):
            attempt = services.start(self.customer, m.pk)
            services.submit_proof(self.customer, attempt.pk, text, None)
        view = next(v for v in services.listing(self.customer) if v.mission.pk == m.pk)
        self.assertEqual((view.pending, view.completed), (2, 0))
        services.approve(MissionAttempt.objects.filter(mission=m).order_by("create_time").first().pk)
        view = next(v for v in services.listing(self.customer) if v.mission.pk == m.pk)
        self.assertEqual((view.pending, view.completed), (1, 1))

    def test_admin_shows_the_qr(self):
        try:
            import segno  # noqa: F401  pylint: disable=import-outside-toplevel,unused-import
        except ImportError:
            self.skipTest("segno is installed with the new image")
        m = self.mission(kind=Mission.Kind.QR, link_url="")
        staff = get_user_model().objects.create_superuser(phone_number="9120007098", password="x-Pass-123")
        self.client.force_login(staff)
        page = self.client.get(f"/admin/missions/mission/{m.pk}/change/").content.decode()
        self.assertIn(f"/pwa/earn/qr/{m.qr_token}", page)
        self.assertIn("data:image/svg+xml;base64,", page)
        old = m.qr_token
        self.client.post("/admin/missions/mission/", {"action": "new_qr", "_selected_action": [str(m.pk)]})
        m.refresh_from_db()
        self.assertNotEqual(m.qr_token, old)
        with self.assertRaises(services.NotFound):
            services.claim_qr(self.customer, old)


@override_settings(CACHES=LOCMEM, MEDIA_ROOT=__import__("pathlib").Path(MEDIA))
class MissionConcurrencyTests(TransactionTestCase):
    """Two requests at the same moment, each on its own database connection (PostgreSQL locks)."""

    def setUp(self):
        cache.clear()
        self.cat = MissionCategory.objects.create(name="حضوری")

    def together(self, *calls):
        """Runs the calls at once; returns what each returned or raised."""
        barrier = threading.Barrier(len(calls))
        results = [None] * len(calls)

        def run(i, call):
            try:
                barrier.wait()
                results[i] = call()
            except Exception as exc:  # pylint: disable=broad-except
                results[i] = exc
            finally:
                connection.close()

        threads = [threading.Thread(target=run, args=(i, c)) for i, c in enumerate(calls)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        return results

    def paid(self, mission):
        return MissionAttempt.objects.filter(mission=mission, status="completed").count()

    def test_a_double_scan_pays_once(self):
        customer = make_player("9120008001").customer
        m = Mission.objects.create(title="کافه", category=self.cat, kind=Mission.Kind.QR, points=20)
        self.together(*[lambda: services.claim_qr(customer, m.qr_token)] * 4)
        self.assertEqual(self.paid(m), 1)
        self.assertEqual(ActivityTransaction.objects.filter(section="mission").count(), 1)

    def test_the_last_place_goes_to_one_player(self):
        players = [make_player(f"912000810{i}").customer for i in range(4)]
        m = Mission.objects.create(title="کافه", category=self.cat, kind=Mission.Kind.QR, points=20, capacity=1)
        results = self.together(*[lambda c=c: services.claim_qr(c, m.qr_token) for c in players])
        self.assertEqual(self.paid(m), 1)
        self.assertEqual(sum(isinstance(r, services.MissionError) for r in results), 3)

    def test_approve_and_reject_together_settle_once(self):
        customer = make_player("9120008201").customer
        m = Mission.objects.create(
            title="میلی", category=self.cat, kind=Mission.Kind.SIGNUP, verification=Mission.Verification.REVIEW,
            link_url="https://mili.example/", points=50,
        )
        attempt = services.start(customer, m.pk)
        services.submit_proof(customer, attempt.pk, "0912", None)
        with mock.patch("apps.notifications.services.queue"):
            results = self.together(lambda: services.approve(attempt.pk), lambda: services.reject(attempt.pk))
        self.assertEqual(sorted(results), [False, True], results)  # one wins, no error
        attempt.refresh_from_db()
        self.assertIn(attempt.status, ("completed", "rejected"))
        self.assertEqual(ActivityTransaction.objects.filter(section="mission").count(), 1 if attempt.status == "completed" else 0)

    def test_two_partner_callbacks_for_the_last_place(self):
        m = Mission.objects.create(
            title="والکس", category=self.cat, kind=Mission.Kind.INSTALL, verification=Mission.Verification.CALLBACK,
            link_url="https://w.example/?c={click_id}", points=30, capacity=1,
        )
        a = services.start(make_player("9120008301").customer, m.pk)
        b = services.start(make_player("9120008302").customer, m.pk)
        self.together(
            lambda: services.partner_callback(m.pk, a.click_id, m.callback_secret),
            lambda: services.partner_callback(m.pk, b.click_id, m.callback_secret),
        )
        self.assertEqual(self.paid(m), 1)


@override_settings(CACHES=LOCMEM, MEDIA_ROOT=__import__("pathlib").Path(MEDIA))
class VenueQrTests(TestCase):
    """A venue screen's QR: a new code every 30 seconds, a photo of it soon useless (2026-11-03)."""

    def setUp(self):
        cache.clear()
        self.user = make_player("9120007301")
        self.customer = self.user.customer
        self.mission = Mission.objects.create(
            title="کافه بردینو", category=MissionCategory.objects.create(name="حضوری"), kind=Mission.Kind.QR,
            points=20, qr_rotating=True, repeat=Mission.Repeat.DAILY, daily_limit=1,
        )

    def points(self):
        return TokenWalletAccount.objects.get(wallet__owner=self.user).amount

    def at(self, seconds):
        return mock.patch.object(services.time, "time", return_value=seconds)

    def test_a_fresh_code_pays_and_an_old_one_is_refused(self):
        self.assertTrue(self.mission.qr_display_key)
        with self.at(1_000_000):
            code, left = services.display_code(self.mission)
        self.assertEqual(left, 20)  # 1_000_000 is 10 s into a 30 s step
        with self.at(1_000_000 + 20 + 120 + 5), self.assertRaises(services.MissionError) as late:
            services.claim_qr(self.customer, code)  # a photo of it, sent on
        self.assertEqual(late.exception.code, "qr_expired")
        with self.at(1_000_000 + 100):
            self.assertFalse(services.claim_qr(self.customer, code).already)
        self.assertEqual(self.points(), 20)

    def test_the_printed_token_and_forged_codes_are_refused(self):
        token = self.mission.qr_token
        with self.assertRaises(services.MissionError) as printed:
            services.claim_qr(self.customer, token)
        self.assertEqual(printed.exception.code, "qr_expired")
        with self.at(1_000_000):
            code, _left = services.display_code(self.mission)
            start = code.split("~")[1]
            for forged in (f"{token}~{start}~{'0' * 20}", f"{token}~r{int(start[1:]) + 30}~{code.split('~')[2]}",
                           f"{token}~h{start[1:]}~{code.split('~')[2]}", f"{token}~r~x", "~~", f"{token}~r1~é"):
                with self.assertRaises(services.MissionError, msg=forged):
                    services.claim_qr(self.customer, forged)
        # A printed mission takes no screen codes.
        printed_mission = Mission.objects.create(title="چاپی", category=self.mission.category, kind=Mission.Kind.QR, points=5)
        with self.at(1_000_000), self.assertRaises(services.NotFound):
            services.claim_qr(self.customer, services.display_code(printed_mission)[0])
        self.assertEqual(self.points(), 0)

    def test_a_scan_while_signed_out_is_held_through_the_sign_in(self):
        api = APIClient()
        with self.at(1_000_000):
            code, _left = services.display_code(self.mission)
            hold = api.post(f"/api/v1/missions/qr/{code}/hold/").json()["result"]["code"]
        self.assertIn("~h", hold)
        with self.at(1_000_000 + 10 * 60):  # ten minutes of SMS sign-in later
            self.assertFalse(services.claim_qr(self.customer, hold).already)
        with self.at(1_000_000 + 16 * 60), self.assertRaises(services.MissionError):
            services.claim_qr(make_player("9120007302").customer, hold)  # a hold lasts 15 minutes
        with self.at(1_000_000 + 600):
            self.assertEqual(api.post(f"/api/v1/missions/qr/{code}/hold/").status_code, 410)  # too late to hold

    def test_the_venue_screen_shows_the_current_code(self):
        try:
            import segno  # noqa: F401  pylint: disable=import-outside-toplevel,unused-import
        except ImportError:
            self.skipTest("segno is installed with the new image")
        api = APIClient()
        r = api.get(f"/api/v1/missions/venue/{self.mission.qr_display_key}/")
        self.assertEqual(r.status_code, 200, r.content)
        body = r.json()["result"]
        self.assertEqual((body["title"], body["points"], body["step"]), ("کافه بردینو", 20, 30))
        self.assertTrue(120 < body["valid_for"] <= 150)
        self.assertIn("/pwa/earn/qr/", body["url"])
        self.assertTrue(body["svg"].startswith("<svg"))
        self.assertEqual(r["Cache-Control"], "no-store")
        self.assertEqual(api.get("/api/v1/missions/venue/wrong-key/").status_code, 404)
        # Scanned and claimed in the app.
        player = APIClient()
        player.force_authenticate(self.user)
        code = body["url"].rsplit("/", 1)[1]
        self.assertEqual(player.post(f"/api/v1/missions/qr/{code}/").json()["result"]["points"], 20)

    def test_the_admin_shows_the_screen_link_only_to_editors_and_can_replace_it(self):
        from django.contrib.auth.models import Permission  # pylint: disable=import-outside-toplevel

        url = f"/admin/missions/mission/{self.mission.pk}/change/"
        viewer = get_user_model().objects.create_user(phone_number="9120007303", password="x-Pass-123")
        viewer.is_admin = True
        viewer.save()
        viewer.user_permissions.add(Permission.objects.get(codename="view_mission"))
        self.client.force_login(viewer)
        self.assertNotIn(self.mission.qr_display_key, self.client.get(url).content.decode())
        boss = get_user_model().objects.create_superuser(phone_number="9120007304", password="x-Pass-123")
        self.client.force_login(boss)
        self.assertIn(f"/venue/{self.mission.qr_display_key}", self.client.get(url).content.decode())
        old_key = self.mission.qr_display_key
        self.client.post("/admin/missions/mission/", {"action": "new_qr", "_selected_action": [str(self.mission.pk)]})
        self.mission.refresh_from_db()
        self.assertNotEqual(self.mission.qr_display_key, old_key)
        self.assertEqual(APIClient().get(f"/api/v1/missions/venue/{old_key}/").status_code, 404)

    def test_hostile_codes_are_refused_cleanly(self):
        """Codex review 2026-11-03: «²» passes str.isdigit() but not int(); a huge number neither."""
        api = APIClient()
        player = APIClient()
        player.force_authenticate(self.user)
        token = self.mission.qr_token
        for code in ("unknown~r²~x", f"{token}~r{'9' * 4301}~x", f"{token}~r١٢٣~x", "~~", f"{token}~r1~é", "x" * 500, f"{token}~q1~x"):
            self.assertIn(api.post(f"/api/v1/missions/qr/{code}/hold/").status_code, (404, 410), code)
            self.assertIn(player.post(f"/api/v1/missions/qr/{code}/").status_code, (404, 410), code)
        self.assertEqual(self.points(), 0)

    def test_guest_scans_never_use_up_the_screens_budget(self):
        api = APIClient()
        for _ in range(40):  # a room full of guests on the venue's Wi-Fi (one address)
            api.post("/api/v1/missions/qr/invalid/hold/")
        try:
            import segno  # noqa: F401  pylint: disable=import-outside-toplevel,unused-import
        except ImportError:
            self.skipTest("segno is installed with the new image")
        self.assertEqual(api.get(f"/api/v1/missions/venue/{self.mission.qr_display_key}/").status_code, 200)

    def test_only_a_qr_mission_can_rotate(self):
        banner = Mission(title="b", category=self.mission.category, kind=Mission.Kind.BANNER, points=1, link_url="https://e.x/", qr_rotating=True)
        with self.assertRaises(ValidationError):
            banner.full_clean()


@override_settings(CACHES=LOCMEM, MEDIA_ROOT=__import__("pathlib").Path(MEDIA))
class InterstitialMissionTests(TestCase):
    """«دیدن تبلیغ تمام‌صفحه» (2026-11-06): Adivery's full-screen placement, paid like a banner."""

    def setUp(self):
        cache.clear()
        self.user = make_player("9120007401")
        self.customer = self.user.customer
        self.api = APIClient()
        self.api.force_authenticate(self.user)
        self.mission = Mission.objects.create(
            title="تبلیغ تمام‌صفحه", category=MissionCategory.objects.create(name="تبلیغات"), kind=Mission.Kind.INTERSTITIAL,
            points=4, repeat=Mission.Repeat.DAILY, daily_limit=3, min_seconds=5,
        )

    def points(self):
        return TokenWalletAccount.objects.get(wallet__owner=self.user).amount

    def test_it_is_shown_then_paid_after_its_wait(self):
        listed = self.api.get("/api/v1/missions/").json()["result"]["missions"]
        self.assertEqual(next(m for m in listed if m["id"] == str(self.mission.pk))["state"], "available")
        attempt = self.api.post(f"/api/v1/missions/{self.mission.pk}/start/").json()["result"]["mission"]["attempt"]
        self.assertEqual(attempt["ad"]["format"], "interstitial")
        self.assertEqual(attempt["ad"]["creative"]["placement_id"], "f720b85e-b057-4f06-9ca8-77a83824568b")
        self.assertFalse(attempt["opened"])
        with self.assertRaises(services.MissionError) as early:
            services.claim(self.customer, attempt["id"])
        self.assertEqual(early.exception.code, "not_opened")
        services.mark_opened(self.customer, attempt["id"])  # the app: the ad is on screen
        with self.assertRaises(services.MissionError) as soon:
            services.claim(self.customer, attempt["id"])
        self.assertEqual(soon.exception.code, "too_soon")
        MissionAttempt.objects.filter(pk=attempt["id"]).update(opened_at=timezone.now() - timedelta(seconds=6))
        self.assertFalse(services.claim(self.customer, attempt["id"]).already)
        self.assertEqual(self.points(), 4)
        self.assertTrue(services.claim(self.customer, attempt["id"]).already)  # paid once
        self.assertEqual(self.points(), 4)

    def test_without_a_placement_it_is_not_offered(self):
        from apps.configuration.models import SystemConfiguration  # pylint: disable=import-outside-toplevel
        from apps.wallet.services import ad_reward  # pylint: disable=import-outside-toplevel

        with mock.patch.dict(ad_reward.DEFAULTS, {"ADIVERY_INTERSTITIAL_PLACEMENT_ID": ""}):
            SystemConfiguration.objects.filter(key="ADIVERY_INTERSTITIAL_PLACEMENT_ID").delete()
            cache.clear()
            listed = self.api.get("/api/v1/missions/").json()["result"]["missions"]
            self.assertEqual(next(m for m in listed if m["id"] == str(self.mission.pk))["state"], "inactive")
            with self.assertRaises(services.MissionError):
                services.start(self.customer, self.mission.pk)

    def test_it_takes_no_link_and_only_automatic_verification(self):
        self.mission.full_clean()  # no link needed
        self.mission.verification = Mission.Verification.REVIEW
        with self.assertRaises(ValidationError):
            self.mission.full_clean()


@override_settings(CACHES=LOCMEM, MEDIA_ROOT=__import__("pathlib").Path(MEDIA))
class MysteryTests(TestCase):
    """«معمای شهری» (2026-11-07): a chain of clues, each step proved at its place."""

    def setUp(self):
        cache.clear()
        from apps.missions.models import Mystery, MysteryStep  # pylint: disable=import-outside-toplevel

        self.Mystery, self.Step = Mystery, MysteryStep
        self.user = make_player("9120007501")
        self.customer = self.user.customer
        self.api = APIClient()
        self.api.force_authenticate(self.user)
        self.mystery = Mystery.objects.create(title="راز میدان", story="یک نامه پیدا شد…", finish_points=50)
        P = MysteryStep.Proof
        self.qr = MysteryStep.objects.create(mystery=self.mystery, order=1, clue="جایی که قهوه بوی کتاب می‌دهد", place_name="کافه کتاب", points=10, proof=P.QR)
        self.gps = MysteryStep.objects.create(
            mystery=self.mystery, order=2, clue="زیر برج ساعت", place_name="برج ساعت", points=15, proof=P.GPS,
            latitude="35.700000", longitude="51.400000", radius_m=100,
        )
        self.answer = MysteryStep.objects.create(
            mystery=self.mystery, order=3, clue="سردر قدیمی", place_name="خانهٔ قدیمی", points=20, proof=P.ANSWER,
            question="سال ساخت روی سردر؟", answers="۱۳۰۵|هزار و سیصد و پنج",
        )
        self.staff = MysteryStep.objects.create(
            mystery=self.mystery, order=4, clue="نان تازه", place_name="نانوایی سنگک", points=25, proof=P.STAFF,
            staff_code="نان-۴۷", check_location=True, latitude="35.710000", longitude="51.410000", radius_m=80,
            place_offer="۱۰٪ تخفیف",
        )

    def points(self):
        return TokenWalletAccount.objects.get(wallet__owner=self.user).amount

    def detail(self):
        r = self.api.get(f"/api/v1/missions/mysteries/{self.mystery.pk}/")
        self.assertEqual(r.status_code, 200, r.content)
        return r.json()["result"]["mystery"] if "result" in r.json() else r.json()["mystery"]

    def checkin(self, step, **data):
        return self.api.post(f"/api/v1/missions/mysteries/{self.mystery.pk}/steps/{step.pk}/checkin/", data, format="json")

    def start(self):
        r = self.api.post(f"/api/v1/missions/mysteries/{self.mystery.pk}/start/", {}, format="json")
        self.assertEqual(r.status_code, 201, r.content)

    def body(self, r):
        data = r.json()
        return data["result"] if data["is_successful"] else data["errors"]

    def test_the_list_shows_it_and_no_secret_ever_leaves(self):
        r = self.api.get("/api/v1/missions/")
        card = self.body(r)["mysteries"][0]
        self.assertEqual((card["state"], card["steps"], card["done"], card["points"]), ("available", 4, 0, 10 + 15 + 20 + 25 + 50))
        self.start()
        raw = self.api.get(f"/api/v1/missions/mysteries/{self.mystery.pk}/").content.decode()
        for secret in ("1305", "۱۳۰۵", "نان-۴۷", "35.7", "51.4", self.qr.qr_token, "کافه کتاب", "خانهٔ قدیمی"):
            self.assertNotIn(secret, raw)
        steps = self.detail()["step_list"]
        self.assertEqual([s["state"] for s in steps], ["current", "locked", "locked", "locked"])
        self.assertNotIn("clue", steps[1])

    def test_a_whole_game_pays_every_step_and_the_bonus_once(self):
        start = self.points()
        # Step 1's QR starts the mystery by itself (a poster at the first place is the way in).
        r = self.api.post(f"/api/v1/missions/qr/{self.qr.qr_token}/", {}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(self.body(r)["mystery"]["id"], str(self.mystery.pk))
        self.assertEqual(self.points(), start + 10)
        again = self.api.post(f"/api/v1/missions/qr/{self.qr.qr_token}/", {}, format="json")
        self.assertTrue(self.body(again)["already_rewarded"])
        self.assertEqual(self.points(), start + 10)

        far = self.checkin(self.gps, lat=35.71, lng=51.40, accuracy=10)
        self.assertEqual((far.status_code, self.body(far)["code"]), (409, "too_far"))
        vague = self.checkin(self.gps, lat=35.7, lng=51.4, accuracy=2000)
        self.assertEqual(self.body(vague)["code"], "location_inaccurate")
        ok = self.checkin(self.gps, lat=35.7008, lng=51.4, accuracy=20)  # ~89 m
        self.assertEqual(ok.status_code, 200, ok.content)
        self.assertEqual(self.points(), start + 25)

        self.assertEqual(self.body(self.checkin(self.answer, answer="1306"))["code"], "wrong")
        good = self.checkin(self.answer, answer=" 1305 ")
        self.assertEqual(good.status_code, 200, good.content)

        near_code = self.checkin(self.staff, code="نان۴۷", lat=35.70, lng=51.40, accuracy=10)
        self.assertEqual(self.body(near_code)["code"], "too_far")  # the right code, from the wrong place
        last = self.checkin(self.staff, code="نان ۴۷", lat=35.7101, lng=51.41, accuracy=15)
        self.assertEqual(last.status_code, 200, last.content)
        body = self.body(last)
        self.assertEqual((body["finished"], body["bonus"]), (True, 50))
        self.assertEqual(self.points(), start + 10 + 15 + 20 + 25 + 50)
        steps = body["mystery"]["step_list"]
        self.assertEqual([s["state"] for s in steps], ["done"] * 4)
        self.assertEqual(steps[3]["place"]["offer"], "۱۰٪ تخفیف")
        self.assertIn("neshan.org", steps[3]["place"]["map"])
        self.assertEqual(self.body(self.checkin(self.staff, code="نان-۴۷", lat=35.7101, lng=51.41, accuracy=15))["already_rewarded"], True)
        self.assertEqual(self.points(), start + 120)
        self.assertEqual(ActivityTransaction.objects.filter(customer=self.customer, action_type__startswith="mystery").count(), 5)

    def test_steps_open_in_order(self):
        self.start()
        r = self.checkin(self.gps, lat=35.7, lng=51.4, accuracy=5)
        self.assertEqual(self.body(r)["code"], "not_current")
        self.assertIn("مرحلهٔ 1", self.body(r)["error"])
        # A later QR, or a QR step proved without its QR: refused.
        late = self.Step.objects.create(mystery=self.mystery, order=5, clue="?", place_name="آخر", proof=self.Step.Proof.QR)
        self.assertEqual(self.body(self.api.post(f"/api/v1/missions/qr/{late.qr_token}/", {}, format="json"))["code"], "not_current")
        self.assertEqual(self.body(self.checkin(self.qr))["code"], "use_qr")

    def test_a_hidden_mystery_starts_from_its_first_qr_only(self):
        self.mystery.is_visible = False
        self.mystery.save()
        self.assertEqual(self.body(self.api.get("/api/v1/missions/"))["mysteries"], [])
        r = self.api.post(f"/api/v1/missions/mysteries/{self.mystery.pk}/start/", {}, format="json")
        self.assertEqual(r.status_code, 404)
        self.assertEqual(self.api.post(f"/api/v1/missions/qr/{self.qr.qr_token}/", {}, format="json").status_code, 200)
        self.assertEqual(self.detail()["step_list"][1]["state"], "current")  # its player still sees it

    def test_a_later_steps_qr_does_not_start_the_mystery(self):
        late = self.Step.objects.create(mystery=self.mystery, order=5, clue="?", place_name="آخر", proof=self.Step.Proof.QR)
        r = self.api.post(f"/api/v1/missions/qr/{late.qr_token}/", {}, format="json")
        self.assertEqual(self.body(r)["code"], "not_started")
        self.assertFalse(self.mystery.runs.exists())

    def test_wrong_answers_lead_to_a_wait_that_is_kept(self):
        self.answer.order = 0  # first: the answer step is the one to solve
        self.answer.save()
        self.start()
        for _ in range(4):
            self.assertEqual(self.body(self.checkin(self.answer, answer="no"))["code"], "wrong")
        self.assertEqual(self.body(self.checkin(self.answer, answer="no"))["code"], "locked")
        # Even the right answer waits now.
        r = self.checkin(self.answer, answer="1305")
        self.assertEqual(self.body(r)["code"], "locked")
        self.assertGreater(self.detail()["run"]["locked_in"], 0)
        run = self.mystery.runs.get()
        run.locked_until = timezone.now() - timedelta(seconds=1)
        run.save()
        self.assertEqual(self.checkin(self.answer, answer="هزار و سیصد و پنج").status_code, 200)

    def test_persian_forms_of_an_answer_match(self):
        from apps.missions.mystery import normalize  # pylint: disable=import-outside-toplevel

        self.assertEqual(normalize("كافهٔ  علي ۱۲"), normalize("کافه علی 12"))
        self.assertEqual(normalize("آب‌انبار"), normalize("ابانبار"))
        self.assertEqual(normalize("   "), "")

    def test_capacity_stops_new_players_only_and_the_end_stops_everyone(self):
        self.start()
        self.mystery.capacity = 1
        self.mystery.save()
        other = APIClient()
        other.force_authenticate(make_player("9120007502"))
        r = other.post(f"/api/v1/missions/mysteries/{self.mystery.pk}/start/", {}, format="json")
        self.assertEqual(self.body(r)["code"], "full")
        self.assertEqual(self.body(other.post(f"/api/v1/missions/qr/{self.qr.qr_token}/", {}, format="json"))["code"], "full")
        self.assertEqual(self.api.post(f"/api/v1/missions/qr/{self.qr.qr_token}/", {}, format="json").status_code, 200)
        self.mystery.ends_at = timezone.now() - timedelta(minutes=1)
        self.mystery.save()
        self.assertEqual(self.body(self.checkin(self.gps, lat=35.7, lng=51.4, accuracy=5))["code"], "expired")
        self.assertEqual(self.detail()["state"], "expired")

    def test_a_venue_screen_works_for_a_step_and_codes_never_cross(self):
        self.qr.qr_rotating = True
        self.qr.save()
        r = self.client.get(f"/api/v1/missions/venue/{self.qr.qr_display_key}/")
        self.assertEqual(r.status_code, 200)
        data = r.json().get("result", r.json())
        self.assertEqual(data["title"], "کافه کتاب")
        code = data["url"].rsplit("/", 1)[-1]
        # A QR mission with the same token could never take this step's signature.
        self.assertFalse(services._code_valid(Mission(pk=self.qr.pk, qr_token=self.qr.qr_token), *services._split_code(code)[1:], services.time.time()))
        self.assertEqual(self.api.post(f"/api/v1/missions/qr/{code}/", {}, format="json").status_code, 200)
        # The bare token (an old printed QR) no longer counts: scan the screen.
        self.assertEqual(self.body(self.api.post(f"/api/v1/missions/qr/{self.qr.qr_token}/", {}, format="json"))["code"], "qr_expired")
        hold = self.client.post(f"/api/v1/missions/qr/{code}/hold/")
        self.assertEqual(hold.status_code, 200)

    def test_the_admin_report_and_a_new_season(self):
        self.api.post(f"/api/v1/missions/qr/{self.qr.qr_token}/", {}, format="json")
        staff = get_user_model().objects.create_superuser(phone_number="9120007599", password="x-Pass-123")
        self.client.force_login(staff)
        page = self.client.get(f"/admin/missions/mystery/{self.mystery.pk}/report/")
        self.assertEqual(page.status_code, 200)
        self.assertContains(page, "کافه کتاب")
        from apps.missions import mystery  # pylint: disable=import-outside-toplevel

        report = mystery.report(self.mystery)
        self.assertEqual((report["started"], report["steps"][0]["total"], report["steps"][0]["daily"][-1]), (1, 1, 1))
        self.assertEqual(self.client.get(f"/admin/missions/mystery/{self.mystery.pk}/change/").status_code, 200)
        self.assertEqual(self.client.get("/admin/missions/mystery/").status_code, 200)
        self.assertEqual(self.client.get("/admin/missions/mysterycheckin/").status_code, 200)
        self.client.post("/admin/missions/mystery/", {"action": "new_season", "_selected_action": [str(self.mystery.pk)]})
        copy = self.Mystery.objects.exclude(pk=self.mystery.pk).get()
        self.assertFalse(copy.is_active)
        self.assertEqual(copy.steps.count(), 4)
        new_qr = copy.steps.get(order=1).qr_token
        self.assertTrue(new_qr and new_qr != self.qr.qr_token)

    def test_the_admin_step_form_takes_copied_coordinates(self):
        from apps.missions.admin import MysteryStepForm, parse_point  # pylint: disable=import-outside-toplevel

        self.assertEqual(parse_point("۳۵٫۷۰۰۱، ۵۱٫۳۹۱۲"), (__import__("decimal").Decimal("35.700100"), __import__("decimal").Decimal("51.391200")))
        self.assertIsNone(parse_point("35.7"))
        data = {"mystery": self.mystery.pk, "order": 9, "clue": "c", "points": 5, "proof": "gps", "radius_m": 100, "place_name": "p", "point": ""}
        form = MysteryStepForm(data=data)
        self.assertFalse(form.is_valid())
        self.assertIn("point", form.errors)  # a GPS step needs its point (shown on the one field)
        form = MysteryStepForm(data={**data, "point": "35.7001, 51.3912"})
        self.assertTrue(form.is_valid(), form.errors)
        step = form.save()
        self.assertEqual(str(step.latitude), "35.700100")

    def test_steps_check_their_own_settings(self):
        bad = self.Step(mystery=self.mystery, order=7, clue="c", place_name="p", proof=self.Step.Proof.ANSWER)
        with self.assertRaises(ValidationError):
            bad.full_clean()
        bad = self.Step(mystery=self.mystery, order=7, clue="c", place_name="p", proof=self.Step.Proof.GPS, qr_rotating=True)
        with self.assertRaises(ValidationError):
            bad.full_clean()
