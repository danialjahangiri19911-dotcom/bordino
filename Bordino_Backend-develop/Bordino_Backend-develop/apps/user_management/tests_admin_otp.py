from unittest import mock

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase, override_settings

from apps.user_management import admin_otp

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

    def test_sms_failure_is_reported_and_leaves_no_code(self):
        self.send_sms.return_value = None
        resp = self.request_code()
        self.assertIn("ارسال پیامک ناموفق", resp.content.decode())
        code = self.sent_code()
        self.client.post(LOGIN, {"action": "verify", "code": code})
        self.assertIsNone(self.logged_in_as())

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
