import unittest
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase, override_settings

from apps.user_management import admin_otp

def setUpModule():
    # The SMS goes out in the background in production; here it runs at once, inside the request.
    patcher = mock.patch.object(admin_otp, "_deliver", side_effect=lambda job: job())
    patcher.start()
    unittest.addModuleCleanup(patcher.stop)


LOGIN = "/admin/login/"
ADMIN_PHONE = "9128007728"
OTHER_ADMIN = "9120000001"


@override_settings(
    ADMIN_OTP_WHITELIST=["09128007728"],
    CACHES={"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}},
)
class AdminOTPLoginTests(TestCase):
    def setUp(self):
        cache.clear()
        User = get_user_model()
        self.admin = User.objects.create_superuser(phone_number=ADMIN_PHONE, password="pw-not-used-1")
        self.other = User.objects.create_superuser(phone_number=OTHER_ADMIN, password="pw-not-used-2")
        patcher = mock.patch.object(admin_otp.SMSService, "send_sms", return_value={"ok": True})
        self.send_sms = patcher.start()
        self.addCleanup(patcher.stop)

    def request_code(self, phone="09128007728"):
        return self.client.post(LOGIN, {"action": "send", "phone": phone})

    def sent_code(self):
        return self.send_sms.call_args.args[1]

    def logged_in_as(self):
        return self.client.session.get("_auth_user_id")

    def test_listed_admin_logs_in_with_the_sms_code(self):
        self.request_code()
        self.send_sms.assert_called_once()
        self.assertEqual(self.send_sms.call_args.args[0], ADMIN_PHONE)
        resp = self.client.post(LOGIN, {"action": "verify", "code": self.sent_code()})
        self.assertRedirects(resp, "/admin/", fetch_redirect_response=False)
        self.assertEqual(self.logged_in_as(), str(self.admin.pk))

    def test_unlisted_admin_gets_no_sms_and_the_same_page(self):
        listed = self.request_code().content.decode()
        self.client.post(LOGIN, {"action": "restart"})
        unlisted = self.client.post(LOGIN, {"action": "send", "phone": "0" + OTHER_ADMIN})
        self.send_sms.assert_called_once()  # only the listed number's SMS
        self.assertIn("اگر این شماره مجاز باشد", unlisted.content.decode())
        self.assertIn("اگر این شماره مجاز باشد", listed)
        for guess in ("000000", "123456"):
            self.client.post(LOGIN, {"action": "verify", "code": guess})
        self.assertIsNone(self.logged_in_as())

    def test_listed_number_that_is_not_an_admin_gets_no_sms(self):
        self.admin.is_admin = False
        self.admin.save()
        self.request_code()
        self.send_sms.assert_not_called()

    def test_password_form_no_longer_logs_in(self):
        self.client.post(LOGIN, {"username": ADMIN_PHONE, "password": "pw-not-used-1"})
        self.assertIsNone(self.logged_in_as())

    def test_code_is_single_use(self):
        self.request_code()
        code = self.sent_code()
        self.client.post(LOGIN, {"action": "verify", "code": code})
        self.client.logout()
        session = self.client.session
        session[admin_otp.SESSION_PHONE] = ADMIN_PHONE
        session.save()
        self.client.post(LOGIN, {"action": "verify", "code": code})
        self.assertIsNone(self.logged_in_as())

    def test_code_is_burned_after_too_many_wrong_guesses(self):
        self.request_code()
        code = self.sent_code()
        wrong = "000000" if code != "000000" else "111111"
        for _ in range(admin_otp.MAX_ATTEMPTS):
            self.client.post(LOGIN, {"action": "verify", "code": wrong})
        self.client.post(LOGIN, {"action": "verify", "code": code})
        self.assertIsNone(self.logged_in_as())

    def test_resend_is_throttled(self):
        self.request_code()
        resp = self.client.post(LOGIN, {"action": "resend"})
        self.send_sms.assert_called_once()
        self.assertIn("کمی صبر کنید", resp.content.decode())

    def test_sms_failure_looks_like_any_answer_and_leaves_no_code(self):
        self.send_sms.return_value = None
        resp = self.request_code()
        self.assertIn("اگر این شماره مجاز باشد", resp.content.decode())  # (a failure would tell who is listed)
        code = self.sent_code()
        self.client.post(LOGIN, {"action": "verify", "code": code})
        self.assertIsNone(self.logged_in_as())

    def test_the_sms_is_not_waited_for(self):
        jobs = []
        with mock.patch.object(admin_otp, "_deliver", side_effect=jobs.append):
            self.assertEqual(admin_otp.send_code(ADMIN_PHONE), "sent")
            self.assertEqual(admin_otp.send_code("9120009999"), "sent")
        # The listed number's SMS is a background job (the answer never waits for the gateway); the
        # other number did the same work up front (a code record) and has no job.
        self.send_sms.assert_not_called()
        self.assertEqual(len(jobs), 1)
        self.assertTrue(cache.get(admin_otp._keys("9120009999")[0]))  # pylint: disable=protected-access
        jobs[0]()
        self.send_sms.assert_called_once()

    def test_an_old_code_check_racing_a_resend_never_logs_in_twice(self):
        code_key = admin_otp._keys(ADMIN_PHONE)[0]  # pylint: disable=protected-access
        admin_otp.send_code(ADMIN_PHONE)
        first = self.sent_code()
        old_record = cache.get(code_key)
        self.assertIsNotNone(admin_otp.verify_code(ADMIN_PHONE, first))  # B uses the code
        cache.delete(admin_otp._keys(ADMIN_PHONE)[2])  # pylint: disable=protected-access
        admin_otp.send_code(ADMIN_PHONE)  # a resend: a new code
        second = self.sent_code()
        # A read the old record before B finished, and checks the same code now.
        real_get = admin_otp.cache.get
        reads = iter([old_record])
        with mock.patch.object(admin_otp.cache, "get", side_effect=lambda k, *a: next(reads, None) or real_get(k, *a) if k == code_key else real_get(k, *a)):
            self.assertIsNone(admin_otp.verify_code(ADMIN_PHONE, first))
        # …and the new code was not removed by it.
        self.assertIsNotNone(admin_otp.verify_code(ADMIN_PHONE, second))

    def test_offsite_next_is_ignored(self):
        self.client.post(LOGIN, {"action": "send", "phone": "09128007728", "next": "https://evil.example/"})
        resp = self.client.post(
            LOGIN, {"action": "verify", "code": self.sent_code(), "next": "https://evil.example/"}
        )
        self.assertRedirects(resp, "/admin/", fetch_redirect_response=False)

    @override_settings(ADMIN_OTP_WHITELIST=[])
    def test_empty_whitelist_lets_nobody_in(self):
        self.request_code()
        self.send_sms.assert_not_called()


class NormalizePhoneTests(TestCase):
    def test_forms(self):
        for raw in ("09128007728", "+989128007728", "00989128007728", "9128007728", "۰۹۱۲۸۰۰۷۷۲۸", "0912 800 7728"):
            self.assertEqual(admin_otp.normalize_phone(raw), "9128007728", raw)
        for raw in ("", None, "12345", "08128007728", "091280077281"):
            self.assertEqual(admin_otp.normalize_phone(raw), "", raw)


@override_settings(
    ADMIN_OTP_WHITELIST=["09128007728"],
    CACHES={"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}},
)
class AdminOTPChallengeTests(TestCase):
    """Codex fix review (2026-11-10): nothing removes a newer code; a waiting SMS of a replaced code is
    not sent."""

    def setUp(self):
        cache.clear()
        get_user_model().objects.create_superuser(phone_number=ADMIN_PHONE, password="pw-not-used-1")
        patcher = mock.patch.object(admin_otp.SMSService, "send_sms", return_value={"ok": True})
        self.send_sms = patcher.start()
        self.addCleanup(patcher.stop)

    def test_burning_an_old_code_leaves_the_new_one(self):
        jobs = []
        with mock.patch.object(admin_otp, "_deliver", side_effect=jobs.append):
            admin_otp.send_code(ADMIN_PHONE)
            cache.delete(admin_otp._keys(ADMIN_PHONE)[2])  # pylint: disable=protected-access
            admin_otp.send_code(ADMIN_PHONE)  # replaced before the first SMS went out
        jobs[0]()  # the first code's SMS: its code is no longer the live one, nothing is sent
        self.send_sms.assert_not_called()
        jobs[1]()
        code = self.send_sms.call_args.args[1]
        for _ in range(admin_otp.MAX_ATTEMPTS + 1):
            admin_otp.verify_code(ADMIN_PHONE, "000000" if code != "000000" else "111111")
        self.assertIsNone(admin_otp.verify_code(ADMIN_PHONE, code))  # burned by the guesses
        cache.delete(admin_otp._keys(ADMIN_PHONE)[2])  # pylint: disable=protected-access
        with mock.patch.object(admin_otp, "_deliver", side_effect=lambda job: job()):
            admin_otp.send_code(ADMIN_PHONE)
        self.assertIsNotNone(admin_otp.verify_code(ADMIN_PHONE, self.send_sms.call_args.args[1]))
