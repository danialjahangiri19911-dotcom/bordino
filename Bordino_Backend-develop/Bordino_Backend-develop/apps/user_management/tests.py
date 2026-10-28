from unittest import mock

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.user_management.repositories.otp.command import OTPCommandRepository
from apps.user_management.services.otp.attempts import TRIES_PER_CODE, WRONG_PER_DAY
from apps.user_management.services.user.registration import UserRegistrationService
from apps.users.models.customer import Customer
from apps.wallet.models import TokenWalletAccount

LOCMEM = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
LOGIN = "/api/v1/login/"
LOGOUT = "/api/v1/logout/"
RESEND = "/api/v1/resend_otp/"
INTERESTS = "/api/v1/customer/step/interest-selection/me/"


def make_customer(phone):
    user = get_user_model().objects.create_user(phone_number=phone)
    service = UserRegistrationService()
    service._create_customer_for_user(user)  # pylint: disable=protected-access
    service._create_wallet_for_user(user)  # pylint: disable=protected-access
    return user


def result(response):
    body = response.json()
    return body.get("result", body)


@override_settings(CACHES=LOCMEM)
class OtpLoginTests(TestCase):
    """Codex review 2026-10-22 (phase 2): OTP guessing, reuse, disabled accounts, referrals."""

    def setUp(self):
        cache.clear()  # the OTP counters live in the cache
        self.api = APIClient()
        self.user = make_customer("9120000601")
        self.phone = self.user.phone_number

    def new_code(self, code="4321"):
        OTPCommandRepository.create(self.phone, code)

    def login(self, code, **extra):
        return self.api.post(LOGIN, {"phone_number": self.phone, "otp": code, **extra}, format="json")

    def test_right_code_logs_in_once(self):
        self.new_code()
        first = self.login("4321")
        self.assertEqual(first.status_code, 200, first.content)
        self.assertIn("access_token", result(first)["tokens"])
        self.assertEqual(self.login("4321").status_code, 400)  # consumed

    def test_wrong_codes_block_the_code(self):
        self.new_code()
        for _ in range(TRIES_PER_CODE):
            self.assertEqual(self.login("0000").status_code, 400)
        self.assertEqual(self.login("4321").status_code, 400)

    def test_a_new_code_gets_new_tries_until_the_daily_limit(self):
        wrong = 0
        while wrong < WRONG_PER_DAY:
            self.new_code()
            for _ in range(min(TRIES_PER_CODE, WRONG_PER_DAY - wrong)):
                self.login("0000")
                wrong += 1
        self.new_code()
        self.assertEqual(self.login("4321").status_code, 400)

    def test_wrong_codes_below_the_limit_still_allow_the_right_one(self):
        self.new_code()
        for _ in range(TRIES_PER_CODE - 1):
            self.login("0000")
        self.assertEqual(self.login("4321").status_code, 200)

    def test_disabled_account_cannot_log_in(self):
        self.user.is_active = False
        self.user.save()
        self.new_code()
        r = self.login("4321")
        self.assertEqual(r.status_code, 400)
        self.assertNotIn("tokens", r.content.decode())
        self.user.refresh_from_db()
        self.assertFalse(self.user.is_active)

    def test_referral_code_is_attached_to_the_new_customer(self):
        inviter = make_customer("9120000602")
        self.new_code()
        r = self.login("4321", referral_code=inviter.customer.referral_code)
        self.assertEqual(r.status_code, 200, r.content)
        self.user.customer.refresh_from_db()
        self.assertEqual(self.user.customer.invited_by, inviter)

    def test_referral_code_is_ignored_after_the_profile_is_set_up(self):
        inviter = make_customer("9120000603")
        Customer.objects.filter(user=self.user).update(registration_step=Customer.Step.DAILY_USAGE_TIME)
        self.new_code()
        self.assertEqual(self.login("4321", referral_code=inviter.customer.referral_code).status_code, 200)
        self.user.customer.refresh_from_db()
        self.assertIsNone(self.user.customer.invited_by)


@override_settings(CACHES=LOCMEM)
class ResendTests(TestCase):
    def setUp(self):
        cache.clear()  # the OTP counters live in the cache
        self.api = APIClient()
        self.user = make_customer("9120000611")
        ttl = mock.patch(
            "apps.user_management.serializers.otp.utils.otp_exist.cache.ttl", create=True, return_value=0
        )
        ttl.start()
        self.addCleanup(ttl.stop)

    def resend(self):
        return self.api.post(RESEND, {"phone_number": self.user.phone_number}, format="json")

    def test_failed_sms_is_an_error_and_leaves_no_code(self):
        with mock.patch("apps.user_management.services.otp.otp.OTPService.send_otp", return_value=False):
            r = self.resend()
        self.assertEqual(r.status_code, 400, r.content)
        self.assertIsNone(OTPCommandRepository.get_otp(self.user.phone_number))

    def test_sent_sms_is_a_success(self):
        with mock.patch("apps.user_management.services.otp.otp.OTPService.send_otp", return_value=True):
            r = self.resend()
        self.assertEqual(r.status_code, 201, r.content)
        self.assertIsNotNone(OTPCommandRepository.get_otp(self.user.phone_number))

    def test_codes_per_hour_are_capped(self):
        # The SMS "fails" so no code stays cached and every request reaches the sender.
        with mock.patch(
            "apps.user_management.services.otp.otp.OTPService.send_otp", return_value=False
        ) as send:
            for _ in range(12):
                self.resend()
        self.assertEqual(send.call_count, 8)


@override_settings(CACHES=LOCMEM)
class LogoutTests(TestCase):
    def setUp(self):
        cache.clear()  # the OTP counters live in the cache
        self.api = APIClient()
        self.user = make_customer("9120000621")
        OTPCommandRepository.create(self.user.phone_number, "4321")
        tokens = result(
            self.api.post(LOGIN, {"phone_number": self.user.phone_number, "otp": "4321"}, format="json")
        )["tokens"]
        self.access, self.refresh = tokens["access_token"], tokens["refresh_token"]

    def authed_get(self):
        return self.api.get("/api/v1/games/crash/config/", HTTP_AUTHORIZATION=f"Bearer {self.access}")

    def test_logout_ends_both_tokens(self):
        self.assertEqual(self.authed_get().status_code, 200)
        r = self.api.post(
            LOGOUT, {"refresh": self.refresh}, format="json", HTTP_AUTHORIZATION=f"Bearer {self.access}"
        )
        self.assertIn(r.status_code, (200, 201), r.content)
        self.assertEqual(self.authed_get().status_code, 401)
        self.assertEqual(self.api.post("/token/refresh/", {"refresh": self.refresh}, format="json").status_code, 401)

    def test_logout_works_with_an_expired_access_token(self):
        r = self.api.post(LOGOUT, {"refresh": self.refresh}, format="json", HTTP_AUTHORIZATION="Bearer expired.garbage")
        self.assertIn(r.status_code, (200, 201), r.content)
        self.assertEqual(self.api.post("/token/refresh/", {"refresh": self.refresh}, format="json").status_code, 401)


@override_settings(CACHES=LOCMEM)
class OnboardingRewardTests(TestCase):
    def setUp(self):
        cache.clear()  # the OTP counters live in the cache
        self.api = APIClient()
        self.user = make_customer("9120000631")
        self.api.force_authenticate(self.user)

    def points(self):
        return TokenWalletAccount.objects.get(wallet__owner=self.user).amount

    def test_interests_before_the_earlier_steps_pay_nothing(self):
        before = self.points()
        self.assertEqual(self.api.patch(INTERESTS, {}, format="json").status_code, 400)
        self.assertEqual(self.points(), before)

    def test_interests_complete_the_profile_and_pay_once(self):
        Customer.objects.filter(user=self.user).update(registration_step=Customer.Step.INTEREST_SELECTION)
        before = self.points()
        r = self.api.patch(INTERESTS, {}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.user.customer.refresh_from_db()
        self.assertEqual(self.user.customer.registration_step, Customer.Step.COMPLETED)
        paid = self.points() - before
        self.assertGreater(paid, 0)
        self.assertEqual(self.api.patch(INTERESTS, {}, format="json").status_code, 400)
        self.assertEqual(self.points() - before, paid)

    def test_skipping_ahead_to_a_later_step_is_refused(self):
        r = self.api.patch("/api/v1/customer/step/usage-goal/me/", {"signup_reasons": []}, format="json")
        self.assertEqual(r.status_code, 400, r.content)
        self.user.customer.refresh_from_db()
        self.assertEqual(self.user.customer.registration_step, Customer.Step.PROFILE_SETUP)

    def test_reward_is_paid_once_even_if_the_step_is_moved_back(self):
        Customer.objects.filter(user=self.user).update(registration_step=Customer.Step.INTEREST_SELECTION)
        before = self.points()
        self.assertEqual(self.api.patch(INTERESTS, {}, format="json").status_code, 200)
        paid = self.points() - before
        # A stale write puts the step back (the race Codex found); the reward must not repeat.
        Customer.objects.filter(user=self.user).update(registration_step=Customer.Step.INTEREST_SELECTION)
        self.assertEqual(self.api.patch(INTERESTS, {}, format="json").status_code, 200)
        self.assertEqual(self.points() - before, paid)


@override_settings(CACHES=LOCMEM)
class OtpClaimTests(TestCase):
    def setUp(self):
        cache.clear()

    def test_a_code_read_before_a_resend_cannot_claim_the_new_one(self):
        OTPCommandRepository.create("9120000641", "1111")
        _, token = OTPCommandRepository.read_for_claim("9120000641")
        OTPCommandRepository.create("9120000641", "1111")  # resent, same digits by chance
        self.assertFalse(OTPCommandRepository.claim("9120000641", token))
        self.assertIsNotNone(OTPCommandRepository.get_otp("9120000641"))

    def test_a_code_is_claimed_once(self):
        OTPCommandRepository.create("9120000642", "2222")
        _, token = OTPCommandRepository.read_for_claim("9120000642")
        self.assertTrue(OTPCommandRepository.claim("9120000642", token))
        self.assertFalse(OTPCommandRepository.claim("9120000642", token))


@override_settings(CACHES=LOCMEM)
class AvatarTests(TestCase):
    """Codex review 2026-10-23 (phase 6): avatar uploads."""

    def setUp(self):
        import shutil  # pylint: disable=import-outside-toplevel
        import tempfile  # pylint: disable=import-outside-toplevel

        media = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, media, ignore_errors=True)
        from django.conf import settings  # pylint: disable=import-outside-toplevel

        storages = {
            **settings.STORAGES,
            "default": {
                "BACKEND": "django.core.files.storage.FileSystemStorage",
                "OPTIONS": {"location": media, "base_url": "/media/"},
            },
        }
        override = override_settings(MEDIA_ROOT=media, STORAGES=storages)
        override.enable()
        self.addCleanup(override.disable)
        cache.clear()
        self.user = make_customer("9120000651")
        self.api = APIClient()
        self.api.force_authenticate(self.user)

    def upload(self, data, name="a.png", ctype="image/png"):
        from django.core.files.uploadedfile import SimpleUploadedFile  # pylint: disable=import-outside-toplevel

        return self.api.patch(
            "/api/v1/customer/profile-image/me/",
            {"image": SimpleUploadedFile(name, data, content_type=ctype)},
            format="multipart",
        )

    @staticmethod
    def png(size, mode="RGB", **kw):
        from io import BytesIO  # pylint: disable=import-outside-toplevel

        from PIL import Image  # pylint: disable=import-outside-toplevel

        buf = BytesIO()
        Image.new(mode, size, (200, 30, 30)).save(buf, "PNG", **kw)
        return buf.getvalue()

    def test_a_normal_image_is_stored_resized(self):
        from PIL import Image  # pylint: disable=import-outside-toplevel

        r = self.upload(self.png((1600, 1200)))
        self.assertEqual(r.status_code, 200, r.content)
        self.user.customer.refresh_from_db()
        with Image.open(self.user.customer.image.file.path) as stored:
            self.assertLessEqual(max(stored.size), 512)

    def test_removing_the_picture_keeps_the_account(self):
        self.assertEqual(self.upload(self.png((64, 64))).status_code, 200)
        self.user.customer.refresh_from_db()
        stored = self.user.customer.image
        path = stored.file.path
        r = self.api.delete("/api/v1/customer/profile-image/me/")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertIsNone(result(r)["image_url"])
        self.user.customer.refresh_from_db()
        self.assertIsNone(self.user.customer.image)
        self.assertTrue(Customer.objects.filter(user=self.user).exists())
        import os  # pylint: disable=import-outside-toplevel

        self.assertFalse(os.path.exists(path))
        # Again (nothing to remove) is fine; another customer's picture is never reachable.
        self.assertEqual(self.api.delete("/api/v1/customer/profile-image/me/").status_code, 200)
        other = make_customer("9120000652")
        other_id = Customer.objects.get(user=other).pk
        self.assertEqual(self.api.delete(f"/api/v1/customer/profile-image/{other_id}/").status_code, 404)
        self.assertEqual(APIClient().delete("/api/v1/customer/profile-image/me/").status_code, 401)

    def test_a_very_wide_image_is_converted_not_a_500(self):
        # 20000×1 is a valid PNG that WebP itself cannot encode at that width: it is shrunk first.
        r = self.upload(self.png((20000, 1)))
        self.assertEqual(r.status_code, 200, r.content)

    def test_an_image_with_absurd_pixel_count_is_a_400(self):
        r = self.upload(self.png((6000, 6000)))  # 36 million pixels, a few KB compressed
        self.assertEqual(r.status_code, 400, r.content)

    def test_a_non_image_is_a_400(self):
        self.assertEqual(self.upload(b"<html><script>1</script></html>", "x.png").status_code, 400)

    def test_exif_orientation_is_applied(self):
        from io import BytesIO  # pylint: disable=import-outside-toplevel

        from PIL import Image  # pylint: disable=import-outside-toplevel

        buf = BytesIO()
        img = Image.new("RGB", (80, 40), (10, 200, 10))
        exif = Image.Exif()
        exif[0x0112] = 6  # rotate 90° for display
        img.save(buf, "JPEG", exif=exif)
        r = self.upload(buf.getvalue(), "p.jpg", "image/jpeg")
        self.assertEqual(r.status_code, 200, r.content)
        self.user.customer.refresh_from_db()
        with Image.open(self.user.customer.image.file.path) as stored:
            self.assertEqual(stored.size, (40, 80))

    def test_replacing_keeps_the_new_avatar_even_if_cleanup_fails(self):
        self.assertEqual(self.upload(self.png((100, 100))).status_code, 200)
        with mock.patch("django.db.models.fields.files.FieldFile.delete", side_effect=OSError("s3")):
            r = self.upload(self.png((120, 120)))
        self.assertEqual(r.status_code, 200, r.content)


class ProfileEditTests(TestCase):
    """«اطلاعات شخصی» (2026-10-27): PATCH customer/profile/me edits name, birthdate and gender."""

    URL = "/api/v1/customer/profile/me/"

    def setUp(self):
        cache.clear()
        self.user = make_customer("9120000771")
        self.api = APIClient()
        self.api.force_authenticate(self.user)

    def test_edits_name_birthdate_gender_and_answers_with_profile(self):
        r = self.api.patch(
            self.URL, {"username": "Player_1", "birthdate": "1990-03-21", "gender": "F"}, format="json"
        )
        self.assertEqual(r.status_code, 200, r.content)
        body = result(r)
        self.assertEqual(body["username"], "Player_1")
        self.assertEqual(body["gender"], "F")
        self.assertEqual(str(body["birthdate"]), "1990-03-21")
        self.user.refresh_from_db()
        self.assertEqual(self.user.username, "Player_1")

    def test_works_after_onboarding_is_complete_and_keeps_the_step(self):
        customer = Customer.objects.get(user=self.user)
        customer.registration_step = Customer.Step.COMPLETED
        customer.save()
        r = self.api.patch(self.URL, {"username": "Later_Name"}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        customer.refresh_from_db()
        self.assertEqual(customer.registration_step, Customer.Step.COMPLETED)

    def test_refuses_a_taken_name(self):
        other = make_customer("9120000772")
        other.username = "Taken"
        other.save()
        r = self.api.patch(self.URL, {"username": "Taken"}, format="json")
        self.assertEqual(r.status_code, 400, r.content)
        self.user.refresh_from_db()
        self.assertNotEqual(self.user.username, "Taken")

    def test_refuses_bad_values(self):
        for payload in (
            {"username": "ab"},
            {"username": "نام فارسی"},
            {"birthdate": "2999-01-01"},
            {"gender": "MF"},
        ):
            r = self.api.patch(self.URL, payload, format="json")
            self.assertEqual(r.status_code, 400, (payload, r.content))

    def test_no_put_and_no_other_customer(self):
        self.assertEqual(self.api.put(self.URL, {"username": "Whole"}, format="json").status_code, 405)
        other = make_customer("9120000773")
        other_id = Customer.objects.get(user=other).pk
        r = self.api.patch(f"/api/v1/customer/profile/{other_id}/", {"username": "Hijack"}, format="json")
        self.assertEqual(r.status_code, 404)
        other.refresh_from_db()
        self.assertNotEqual(other.username, "Hijack")

    def test_needs_a_session(self):
        r = APIClient().patch(self.URL, {"username": "Anon"}, format="json")
        self.assertEqual(r.status_code, 401)


@override_settings(CACHES=LOCMEM)
class AuditPhase3Tests(TestCase):
    """Full Codex audit, phase 3 (2026-10-28): accounts, OTP, profile, notifications."""

    def setUp(self):
        cache.clear()
        self.api = APIClient()
        self.user = make_customer("9120003101")

    def test_renaming_does_not_undo_a_suspension(self):
        from apps.user_management.repositories.user.command import (  # pylint: disable=import-outside-toplevel
            UserCommandRepository,
        )

        stale = get_user_model().objects.get(pk=self.user.pk)  # loaded before the admin acted
        get_user_model().objects.filter(pk=self.user.pk).update(is_active=False)
        UserCommandRepository.change_username(stale, "renamed_player")
        fresh = get_user_model().objects.get(pk=self.user.pk)
        self.assertEqual(fresh.username, "renamed_player")
        self.assertFalse(fresh.is_active)

    def test_the_fixed_test_code_needs_a_debug_build(self):
        from apps.user_management.services.otp.utils import generate_random_code  # pylint: disable=import-outside-toplevel

        with override_settings(ENVIRONMENT="dev", DEBUG=False, DEFAULT_TEST_OTP="1234"):
            self.assertFalse(all(generate_random_code() == "1234" for _ in range(5)))
        with override_settings(ENVIRONMENT="dev", DEBUG=True, DEFAULT_TEST_OTP="1234"):
            self.assertEqual(generate_random_code(), "1234")

    def test_guessing_at_a_used_up_code_does_not_lock_the_phone_for_the_day(self):
        phone = self.user.phone_number
        OTPCommandRepository.create(phone, "4321")
        for _ in range(WRONG_PER_DAY + 5):  # far past the code's own tries
            self.api.post(LOGIN, {"phone_number": phone, "otp": "0000"}, format="json")
        OTPCommandRepository.create(phone, "8765")
        r = self.api.post(LOGIN, {"phone_number": phone, "otp": "8765"}, format="json")
        self.assertEqual(r.status_code, 200, r.content)

    @mock.patch("apps.user_management.services.otp.otp.SMSService.send_sms", return_value="ok")
    def test_registration_counts_against_the_hourly_sms_ceiling(self, send):
        with override_settings(OTP_SENDS_PER_HOUR_ALL=2):
            for i, expected in enumerate((201, 201, 400)):
                r = self.api.post("/api/v1/registration/", {"phone_number": f"91200032{i:02d}"}, format="json")
                self.assertEqual(r.status_code, expected, r.content)
        self.assertEqual(send.call_count, 2)
        # The refused registration left no account behind.
        self.assertFalse(get_user_model().objects.filter(phone_number="9120003202").exists())

    def test_a_failed_profile_reward_does_not_complete_the_profile(self):
        Customer.objects.filter(user=self.user).update(registration_step=Customer.Step.INTEREST_SELECTION)
        self.api.force_authenticate(self.user)
        with mock.patch("apps.wallet.services.balance.add_points", side_effect=RuntimeError("db down")):
            self.assertNotEqual(self.api.patch(INTERESTS, {}, format="json").status_code, 200)
        self.user.customer.refresh_from_db()
        self.assertEqual(self.user.customer.registration_step, Customer.Step.INTEREST_SELECTION)
        r = self.api.patch(INTERESTS, {}, format="json")  # the retry completes and pays
        self.assertEqual(r.status_code, 200, r.content)
