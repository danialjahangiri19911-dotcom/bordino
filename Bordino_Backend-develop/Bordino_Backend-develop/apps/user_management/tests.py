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
