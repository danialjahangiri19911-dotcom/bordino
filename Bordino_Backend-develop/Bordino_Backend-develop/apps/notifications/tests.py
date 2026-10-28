from unittest import mock

from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.notifications import services
from apps.notifications.models import NotificationLog, PushSubscription
from apps.wallet.models import Bank, BankAccount
from apps.wallet.tests import LOCMEM, make_customer

PREFS = "/api/v1/notifications/preferences/"
SUBS = "/api/v1/notifications/push-subscriptions/"
KEYS = {"VAPID_PUBLIC_KEY": "pub", "VAPID_PRIVATE_KEY": "priv"}


def body(response):
    data = response.json()
    return data.get("result", data) if isinstance(data, dict) else data


@override_settings(CACHES=LOCMEM, **KEYS)
class PreferenceTests(TestCase):
    """«مدیریت اعلان‌ها»: the switches were disabled placeholders; now they are stored per player."""

    def setUp(self):
        cache.clear()
        self.user = make_customer("9120001001")
        self.api = APIClient()
        self.api.force_authenticate(self.user)

    def test_switches_start_on_and_are_saved(self):
        first = body(self.api.get(PREFS))
        self.assertEqual((first["lottery"], first["account"], first["games"]), (True, True, True))
        self.assertTrue(first["push_available"])
        changed = body(self.api.patch(PREFS, {"games": False}, format="json"))
        self.assertFalse(changed["games"])
        again = body(self.api.get(PREFS))  # «returning to the page»
        self.assertEqual((again["lottery"], again["account"], again["games"]), (True, True, False))

    def test_a_device_is_registered_and_moves_with_its_browser(self):
        sub = {"endpoint": "https://fcm.googleapis.com/fcm/send/abc", "keys": {"p256dh": "k", "auth": "a"}}
        self.assertEqual(self.api.post(SUBS, sub, format="json").status_code, 201)
        self.assertEqual(body(self.api.get(PREFS))["devices"], 1)
        other = APIClient()
        other_user = make_customer("9120001002")
        other.force_authenticate(other_user)
        other.post(SUBS, sub, format="json")  # same browser, other player
        self.assertEqual(PushSubscription.objects.get().customer, other_user.customer)
        self.assertEqual(self.api.post(SUBS, {"endpoint": "http://x", "keys": {}}, format="json").status_code, 400)

    def test_removing_a_device_only_removes_the_players_own(self):
        PushSubscription.objects.create(customer=self.user.customer, endpoint="https://e/1", p256dh="k", auth="a")
        PushSubscription.objects.create(customer=make_customer("9120001003").customer, endpoint="https://e/2", p256dh="k", auth="a")
        self.api.post(f"{SUBS}remove/", {"endpoint": "https://e/2"}, format="json")
        self.assertEqual(PushSubscription.objects.count(), 2)
        self.api.post(f"{SUBS}remove/", {"endpoint": "https://e/1"}, format="json")
        self.assertEqual(PushSubscription.objects.count(), 1)


@override_settings(CACHES=LOCMEM, **KEYS)
class ReviewFixTests(TestCase):
    """Codex phase-2 review (2026-10-28)."""

    def setUp(self):
        cache.clear()
        self.user = make_customer("9120001301")
        self.api = APIClient()
        self.api.force_authenticate(self.user)

    def test_only_browser_push_services_are_accepted(self):
        for bad in ["https://10.0.0.5/x", "https://localhost/x", "https://fcm.googleapis.com:8443/x", "https://evil.example/x",
                    "https://fcm.googleapis.com.evil.example/x", "http://fcm.googleapis.com/x", "https://user@fcm.googleapis.com/x"]:
            self.assertEqual(self.api.post(SUBS, {"endpoint": bad, "keys": {"p256dh": "k", "auth": "a"}}, format="json").status_code, 400, bad)
        for good in ["https://fcm.googleapis.com/fcm/send/a", "https://updates.push.services.mozilla.com/wpush/v2/a",
                     "https://wns2-db5p.notify.windows.com/w/?token=a", "https://web.push.apple.com/a"]:
            self.assertEqual(self.api.post(SUBS, {"endpoint": good, "keys": {"p256dh": "k", "auth": "a"}}, format="json").status_code, 201, good)

    def test_a_stored_foreign_endpoint_is_never_contacted(self):
        try:
            import pywebpush  # noqa: F401  pylint: disable=import-outside-toplevel,unused-import
        except ImportError:
            self.skipTest("pywebpush not installed in this image")
        PushSubscription.objects.create(customer=self.user.customer, endpoint="https://10.0.0.5/x", p256dh="k", auth="a")
        with mock.patch("pywebpush.webpush") as webpush:
            services._push(PushSubscription.objects.get(), {})
        webpush.assert_not_called()
        self.assertFalse(PushSubscription.objects.exists())

    def test_a_failed_push_frees_its_key_for_the_retry(self):
        PushSubscription.objects.create(customer=self.user.customer, endpoint="https://fcm.googleapis.com/fcm/send/a", p256dh="k", auth="a")
        with mock.patch("apps.notifications.services._push", return_value="failed"):
            with self.assertRaises(services.TransientPushError):
                services.send(self.user.customer, "lottery", "t", key="k9")
        self.assertFalse(NotificationLog.objects.exists())
        with mock.patch("apps.notifications.services._push", return_value="ok") as push:
            self.assertEqual(services.send(self.user.customer, "lottery", "t", key="k9"), 1)
        push.assert_called_once()

    def test_a_broadcast_recipient_whose_push_failed_is_retried(self):
        PushSubscription.objects.create(customer=self.user.customer, endpoint="https://fcm.googleapis.com/fcm/send/a", p256dh="k", auth="a")
        with mock.patch("apps.notifications.services._push", return_value="failed"), mock.patch(
            "apps.notifications.tasks.send_notification.apply_async"
        ) as retry:
            services.broadcast_now("lottery", "t", key="lottery-new:1")
        retry.assert_called_once()
        self.assertEqual(retry.call_args.args[0][0], str(self.user.customer.pk))
        self.assertEqual(retry.call_args.args[0][-1], f"lottery-new:1:{self.user.customer.pk}")

    def test_parallel_switch_changes_do_not_undo_each_other(self):
        pref = services.preferences(self.user.customer)
        stale = type(pref).objects.get(pk=pref.pk)  # read before the other change
        self.api.patch(PREFS, {"account": False}, format="json")
        stale.games = False  # the old code saved every field of a stale copy
        type(pref).objects.filter(pk=pref.pk).update(games=False)
        prefs = body(self.api.get(PREFS))
        self.assertEqual((prefs["account"], prefs["games"]), (False, False))

    @mock.patch("apps.notifications.tasks.send_notification.delay", side_effect=ConnectionError("broker down"))
    def test_a_queue_that_is_down_does_not_break_the_saved_change(self, delay):
        account = BankAccount.objects.create(
            user=self.user, iban="IR700120000000000000000000", bank=Bank.objects.get(code="012"), account_holder="x"
        )
        with self.captureOnCommitCallbacks(execute=True):
            account.status = BankAccount.Status.APPROVED
            account.save()
        delay.assert_called_once()
        account.refresh_from_db()
        self.assertEqual(account.status, BankAccount.Status.APPROVED)


@override_settings(CACHES=LOCMEM, **KEYS)
class SendingTests(TestCase):
    def setUp(self):
        cache.clear()
        self.user = make_customer("9120001101")
        self.customer = self.user.customer
        PushSubscription.objects.create(customer=self.customer, endpoint="https://e/1", p256dh="k", auth="a")

    @mock.patch("apps.notifications.services._push", return_value="ok")
    def test_a_switched_off_category_sends_nothing(self, push):
        services.preferences(self.customer)
        self.customer.notification_preference.games = False
        self.customer.notification_preference.save()
        self.assertEqual(services.send(self.customer, "games", "t"), 0)
        self.assertEqual(services.send(self.customer, "lottery", "t"), 1)
        self.assertEqual(push.call_count, 1)

    @mock.patch("apps.notifications.services._push", return_value="ok")
    def test_a_keyed_notification_is_sent_once(self, push):
        self.assertEqual(services.send(self.customer, "lottery", "t", key="k1"), 1)
        self.assertEqual(services.send(self.customer, "lottery", "t", key="k1"), 0)
        self.assertEqual(NotificationLog.objects.get().delivered, 1)

    @override_settings(VAPID_PRIVATE_KEY="")
    @mock.patch("apps.notifications.services._push", return_value="ok")
    def test_without_keys_nothing_is_pushed(self, push):
        self.assertEqual(services.send(self.customer, "lottery", "t"), 0)
        push.assert_not_called()

    @mock.patch("apps.notifications.tasks.send_notification.delay")
    def test_an_approved_bank_account_notifies_its_owner_after_commit(self, delay):
        account = BankAccount.objects.create(
            user=self.user, iban="IR700120000000000000000000", bank=Bank.objects.get(code="012"), account_holder="x"
        )
        with self.captureOnCommitCallbacks(execute=True):
            account.status = BankAccount.Status.APPROVED
            account.save()
        delay.assert_called_once()
        self.assertEqual(delay.call_args.args[1:3], ("account", "حساب بانکی‌ات تأیید شد"))
        with self.captureOnCommitCallbacks(execute=True):
            account.save()  # no change of status: nothing more
        delay.assert_called_once()

    @mock.patch("apps.notifications.tasks.send_notification.delay")
    def test_a_paid_withdrawal_notifies_with_the_amount_in_toman(self, delay):
        from apps.wallet.models import CurrencyTransaction, CurrencyWalletAccount  # pylint: disable=import-outside-toplevel

        CurrencyWalletAccount.objects.filter(wallet__owner=self.user).update(balance=50_000)
        account = BankAccount.objects.create(
            user=self.user, iban="IR700120000000000000000000", bank=Bank.objects.get(code="012"),
            account_holder="x", status=BankAccount.Status.APPROVED,
        )
        api = APIClient()
        api.force_authenticate(self.user)
        api.post("/api/v1/wallet/currency/withdraw/", {"amount": 20_000, "bank_account_id": str(account.pk)}, format="json")
        tx = CurrencyTransaction.objects.get()
        delay.reset_mock()
        with self.captureOnCommitCallbacks(execute=True):
            tx.status = CurrencyTransaction.Status.COMPLETED
            tx.save()
        delay.assert_called_once()
        self.assertEqual(delay.call_args.args[2], "برداشت واریز شد")
        self.assertIn("۲۰٬۰۰۰ تومان", delay.call_args.args[3])

    @mock.patch("apps.notifications.services._push", return_value="ok")
    def test_games_news_reaches_players_with_the_switch_on(self, push):
        from django.core.management import call_command  # pylint: disable=import-outside-toplevel

        off = make_customer("9120001102").customer
        PushSubscription.objects.create(customer=off, endpoint="https://e/2", p256dh="k", auth="a")
        services.preferences(off)
        off.notification_preference.games = False
        off.notification_preference.save()
        call_command("send_games_news", "بازی تازه", "بیا امتحان کن", "--key", "new-game-1")
        call_command("send_games_news", "بازی تازه", "بیا امتحان کن", "--key", "new-game-1")
        self.assertEqual(push.call_count, 1)


class WebPushWireTests(TestCase):
    """The real pywebpush request (encrypted body + VAPID signature) against a stand-in push service."""

    def test_a_push_request_is_encrypted_and_signed(self):
        try:
            import pywebpush  # noqa: F401  pylint: disable=import-outside-toplevel,unused-import
        except ImportError:
            self.skipTest("pywebpush not installed in this image")
        import base64  # pylint: disable=import-outside-toplevel

        from cryptography.hazmat.primitives import serialization  # pylint: disable=import-outside-toplevel
        from cryptography.hazmat.primitives.asymmetric import ec  # pylint: disable=import-outside-toplevel
        b64 = lambda raw: base64.urlsafe_b64encode(raw).rstrip(b"=").decode()  # noqa: E731
        server = ec.generate_private_key(ec.SECP256R1())
        browser = ec.generate_private_key(ec.SECP256R1())
        point = serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint
        user = make_customer("9120001201")
        sub = PushSubscription.objects.create(
            customer=user.customer, endpoint="https://fcm.googleapis.com/fcm/send/abc",
            p256dh=b64(browser.public_key().public_bytes(*point)), auth=b64(b"0123456789abcdef"),
        )
        sent = {}

        def fake_post(url, data=None, headers=None, timeout=None, **kw):
            sent.update(url=url, data=data, headers=headers)
            return mock.Mock(status_code=201, text="")

        with override_settings(
            VAPID_PUBLIC_KEY=b64(server.public_key().public_bytes(*point)),
            VAPID_PRIVATE_KEY=b64(server.private_numbers().private_value.to_bytes(32, "big")),
            VAPID_SUBJECT="mailto:t@example.com",
        ), mock.patch("requests.post", side_effect=fake_post):
            self.assertEqual(services.send(user.customer, "lottery", "سلام", "متن"), 1)
        self.assertEqual(sent["url"], sub.endpoint)
        self.assertEqual(sent["headers"].get("Content-Encoding"), "aes128gcm")
        self.assertTrue(sent["headers"]["Authorization"].startswith("vapid t="))
        self.assertNotIn("سلام".encode(), sent["data"])  # encrypted, not plain
