import unittest
import uuid
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.configuration.models.system_configuration import SystemConfiguration
from apps.gamemaster import services as gm
from apps.gamemaster.models import Game, GameVersion
from apps.gamemaster.tests import OPEN, quiz
from apps.ops import roles
from apps.ops.auth import tokens_for
from apps.ops.models import OpsAuditLog, OpsMember
from apps.user_management.services.user.sessions import SessionRefreshToken
from apps.wallet.models import Bank, BankAccount, CurrencyTransaction
from apps.wallet.tests import make_customer, rial

LOCMEM = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}


def setUpModule():
    # The sign-in SMS goes out in the background in production; here it runs at once.
    from apps.user_management import admin_otp  # pylint: disable=import-outside-toplevel

    patcher = mock.patch.object(admin_otp, "_deliver", side_effect=lambda job: job())
    patcher.start()
    unittest.addModuleCleanup(patcher.stop)


SMS = "apps.user_management.services.sms.sms.SMSService.send_sms"
O = "/api/v1/ops/"


def body(r):
    data = r.json()
    return data["result"] if data.get("is_successful") else data.get("errors", data)


@override_settings(CACHES=LOCMEM, OPS_OWNERS=["9128007728"])
class OpsTestCase(TestCase):
    def setUp(self):
        cache.clear()
        OPEN.start()
        self.addCleanup(OPEN.stop)
        self.owner = make_customer("9128007728")
        self.reviewer = self.staff("9120001001", ["reviewer"])
        self.finance = self.staff("9120001002", ["finance"])
        self.player = make_customer("9120001009", rial=100_000)

    def staff(self, phone, wanted):
        u = make_customer(phone)
        OpsMember.objects.create(user=u, added_by=None)
        roles.set_roles(u, wanted)
        return u

    def ops(self, user):
        """A client signed in to the admin app (an ops-scoped token)."""
        c = APIClient()
        c.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens_for(user)['access']}")
        return c

    def player_client(self, user):
        c = APIClient()
        c.credentials(HTTP_AUTHORIZATION=f"Bearer {SessionRefreshToken.for_user(user).access_token}")
        return c


class SignInTests(OpsTestCase):
    def test_a_code_goes_only_to_staff_and_works_once(self):
        with mock.patch(SMS, return_value={"ok": 1}) as sms:
            r = APIClient().post(O + "auth/send/", {"phone": "09128007728"}, format="json")
            self.assertEqual(r.status_code, 200, r.content)
            code = sms.call_args[0][1]
            cache.delete("ops_otp:9120001009:gap")
            same = APIClient().post(O + "auth/send/", {"phone": "09120001009"}, format="json")  # a player
            self.assertEqual((same.status_code, body(same)["message"]), (200, body(r)["message"]))  # the same answer
            self.assertEqual(sms.call_count, 1)  # but no SMS
        self.assertEqual(APIClient().post(O + "auth/verify/", {"phone": "09128007728", "code": "000000" if code != "000000" else "111111"}, format="json").status_code, 400)
        ok = APIClient().post(O + "auth/verify/", {"phone": "۰۹۱۲۸۰۰۷۷۲۸", "code": code}, format="json")
        self.assertEqual(ok.status_code, 200, ok.content)
        me = body(ok)["me"]
        self.assertEqual((me["owner"], set(me["roles"])), (True, set(roles.ROLES)))
        self.assertEqual(APIClient().post(O + "auth/verify/", {"phone": "09128007728", "code": code}, format="json").status_code, 400)  # used
        self.assertTrue(OpsAuditLog.objects.filter(action="sign_in").exists())

    def test_the_admin_apps_codes_are_apart_from_the_django_admins(self):
        from apps.user_management import admin_otp  # pylint: disable=import-outside-toplevel

        with mock.patch(SMS, return_value={"ok": 1}) as sms, override_settings(ADMIN_OTP_WHITELIST=[]):
            admin_otp.send_code("9128007728", who=roles.user_for_phone, scope="ops")
            code = sms.call_args[0][1]
            self.assertIsNone(admin_otp.verify_code("9128007728", code))  # not a Django-admin code

    def test_player_tokens_never_open_the_admin_app_and_sessions_are_short(self):
        self.assertEqual(self.player_client(self.owner).get(O + "me/").status_code, 403)
        self.assertEqual(self.ops(self.owner).get(O + "me/").status_code, 200)
        tokens = tokens_for(self.reviewer)
        r = APIClient().post(O + "auth/refresh/", {"refresh": tokens["refresh"]}, format="json")
        self.assertEqual(r.status_code, 200)
        # The player app's refresh does not renew an admin-app token (it would make it last 14 days).
        self.assertEqual(APIClient().post("/token/refresh/", {"refresh": tokens["refresh"]}, format="json").status_code, 401)
        # A player refresh token is not an admin-app one.
        player_refresh = str(SessionRefreshToken.for_user(self.reviewer))
        self.assertEqual(APIClient().post(O + "auth/refresh/", {"refresh": player_refresh}, format="json").status_code, 401)
        # Deactivated: refused at once and at refresh.
        OpsMember.objects.filter(user=self.reviewer).update(is_active=False)
        self.assertEqual(self.ops(self.reviewer).get(O + "me/").status_code, 403)
        self.assertEqual(APIClient().post(O + "auth/refresh/", {"refresh": tokens["refresh"]}, format="json").status_code, 401)

    def test_logout_ends_the_session(self):
        tokens = tokens_for(self.reviewer)
        c = APIClient()
        c.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
        self.assertEqual(c.post(O + "auth/logout/", {}, format="json").status_code, 200)
        self.assertEqual(c.get(O + "me/").status_code, 401)
        self.assertEqual(APIClient().post(O + "auth/refresh/", {"refresh": tokens["refresh"]}, format="json").status_code, 401)


class RoleTests(OpsTestCase):
    def test_each_section_is_open_only_to_its_role(self):
        rv, fn = self.ops(self.reviewer), self.ops(self.finance)
        self.assertEqual(rv.get(O + "games/queue/").status_code, 200)
        self.assertEqual(fn.get(O + "games/queue/").status_code, 403)
        self.assertEqual(fn.get(O + "withdrawals/").status_code, 200)
        self.assertEqual(rv.get(O + "withdrawals/").status_code, 403)
        for c in (rv, fn):
            self.assertEqual(c.get(O + "settings/").status_code, 403)
            self.assertEqual(c.get(O + "staff/").status_code, 403)
            self.assertEqual(c.get(O + "overview/").status_code, 200)
        own = self.ops(self.owner)
        for path in ("games/queue/", "withdrawals/", "bank-accounts/", "settings/", "staff/", "overview/", "audit/"):
            self.assertEqual(own.get(O + path).status_code, 200, path)
        # The reviewer role is the same permission Game Master checks.
        self.assertTrue(gm.is_reviewer(get_user_model().objects.get(pk=self.reviewer.pk)))
        self.assertFalse(gm.is_reviewer(get_user_model().objects.get(pk=self.finance.pk)))

    def test_the_owner_manages_the_staff(self):
        own = self.ops(self.owner)
        new = make_customer("9120001003")
        r = own.post(O + "staff/", {"phone": "09120001003", "roles": ["settings", "support"]}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(set(roles.roles_of(new)), {"settings", "support"})
        self.assertEqual(self.ops(new).get(O + "settings/").status_code, 200)
        self.assertEqual(body(own.post(O + "staff/", {"phone": "09129999999", "roles": ["support"]}, format="json"))["code"], "not_registered")
        self.assertEqual(body(own.post(O + "staff/", {"phone": "09128007728", "roles": ["support"]}, format="json"))["code"], "owner")
        mid = body(r)["member"]["id"]
        self.assertEqual(own.patch(O + f"staff/{mid}/", {"roles": ["support"]}, format="json").status_code, 200)
        self.assertEqual(roles.roles_of(get_user_model().objects.get(pk=new.pk)), ["support"])
        self.assertEqual(own.patch(O + f"staff/{mid}/", {"active": False}, format="json").status_code, 200)
        self.assertEqual(self.ops(new).get(O + "me/").status_code, 403)
        self.assertEqual(own.delete(O + f"staff/{mid}/").status_code, 200)
        self.assertFalse(OpsMember.objects.filter(user=new).exists())
        self.assertEqual(roles.roles_of(get_user_model().objects.get(pk=new.pk)), [])
        self.assertTrue(OpsAuditLog.objects.filter(action="staff_remove").exists())
        # Not the owner: no staff management.
        self.assertEqual(self.ops(self.reviewer).post(O + "staff/", {"phone": "09120001009", "roles": ["finance"]}, format="json").status_code, 403)


class GameReviewTests(OpsTestCase):
    def submitted(self, creator):
        api = APIClient()
        api.force_authenticate(creator)
        api.patch("/api/v1/gm/profile/", {"preferred_mode": "creator", "intent": "pro", "accept_terms": True}, format="json")
        gid = body(api.post("/api/v1/gm/games/", {"category": "pro"}, format="json"))["game"]["id"]
        api.patch(f"/api/v1/gm/games/{gid}/", {"draft": quiz()}, format="json")
        self.assertEqual(api.post(f"/api/v1/gm/games/{gid}/submit/", {}, format="json").status_code, 200)
        return api, gid, GameVersion.objects.get(game_id=gid)

    def test_review_from_the_admin_app(self):
        creator = make_customer("9120001004", rial=0)
        from apps.wallet.models import TokenWalletAccount  # pylint: disable=import-outside-toplevel

        TokenWalletAccount.objects.filter(wallet__owner=creator).update(amount=5000)
        api, gid, v = self.submitted(creator)
        rv = self.ops(self.reviewer)
        queue = body(rv.get(O + "games/queue/"))["versions"]
        self.assertEqual([x["id"] for x in queue], [str(v.pk)])
        detail = body(rv.get(O + f"games/versions/{v.pk}/"))["version"]
        self.assertEqual(detail["stages"][0]["answers"], ["1404"])  # staff see the answers
        self.assertTrue(detail["can_decide"])
        self.assertEqual(rv.post(O + f"games/versions/{v.pk}/decide/", {"decision": "reject"}, format="json").status_code, 409)  # no reason
        self.assertEqual(rv.post(O + f"games/versions/{v.pk}/decide/", {"decision": "approve"}, format="json").status_code, 200)
        self.assertEqual(GameVersion.objects.get(pk=v.pk).status, "approved")
        self.assertTrue(OpsAuditLog.objects.filter(action="game_approve", target_id=str(v.pk)).exists())
        # Published, then Bordino pauses and ends it from the app.
        self.assertEqual(api.post(f"/api/v1/gm/games/{gid}/publish/", {}, format="json").status_code, 200)
        self.assertEqual([g["id"] for g in body(rv.get(O + "games/live/"))["games"]], [gid])
        self.assertEqual(rv.post(O + f"games/{gid}/pause/", {}, format="json").status_code, 200)
        self.assertTrue(Game.objects.get(pk=gid).paused_by_admin)
        self.assertEqual(rv.post(O + f"games/{gid}/resume/", {}, format="json").status_code, 200)
        self.assertEqual(rv.post(O + f"games/{gid}/expire/", {}, format="json").status_code, 200)
        self.assertEqual(Game.objects.get(pk=gid).status, "expired")

    def test_the_owner_has_every_role_where_it_is_checked_too(self):
        creator = make_customer("9120001005")
        from apps.wallet.models import TokenWalletAccount  # pylint: disable=import-outside-toplevel

        TokenWalletAccount.objects.filter(wallet__owner=creator).update(amount=5000)
        _api, _gid, v = self.submitted(creator)
        self.assertFalse(self.owner.is_superuser)  # (an owner by settings, not a Django superuser)
        r = self.ops(self.owner).post(O + f"games/versions/{v.pk}/decide/", {"decision": "approve"}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertTrue(gm.is_reviewer(get_user_model().objects.get(pk=self.owner.pk)))

    def test_a_reviewer_never_reviews_their_own_game(self):
        from apps.wallet.models import TokenWalletAccount  # pylint: disable=import-outside-toplevel

        TokenWalletAccount.objects.filter(wallet__owner=self.reviewer).update(amount=5000)
        _api, _gid, v = self.submitted(self.reviewer)
        rv = self.ops(self.reviewer)
        self.assertFalse(body(rv.get(O + f"games/versions/{v.pk}/"))["version"]["can_decide"])
        self.assertEqual(rv.post(O + f"games/versions/{v.pk}/decide/", {"decision": "approve"}, format="json").status_code, 403)


class MoneyTests(OpsTestCase):
    def setUp(self):
        super().setUp()
        self.bank = Bank.objects.create(name="بانک آزمایش", code="T9")
        self.account = BankAccount.objects.create(user=self.player, iban="IR000000000000000000000001", bank=self.bank, account_holder="بازیکن", status=BankAccount.Status.APPROVED)
        self.papi = APIClient()
        self.papi.force_authenticate(self.player)

    def withdraw(self, amount):
        r = self.papi.post("/api/v1/wallet/currency/withdraw/", {"amount": amount, "bank_account_id": str(self.account.pk), "request_id": str(uuid.uuid4())}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        return CurrencyTransaction.objects.latest("create_time")

    def test_paying_needs_the_banks_reference_and_closes_it(self):
        tx = self.withdraw(30_000)
        fn = self.ops(self.finance)
        listed = body(fn.get(O + "withdrawals/"))
        self.assertEqual((listed["pending_amount"], listed["withdrawals"][0]["bank"]["iban"]), (30_000, self.account.iban))
        detail = body(fn.get(O + f"withdrawals/{tx.pk}/"))
        self.assertEqual(detail["player"]["cash_balance"], 70_000)
        self.assertEqual(fn.post(O + f"withdrawals/{tx.pk}/pay/", {}, format="json").status_code, 400)
        with mock.patch("apps.notifications.services.queue") as told:
            r = fn.post(O + f"withdrawals/{tx.pk}/pay/", {"reference": "REF-123"}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        tx.refresh_from_db()
        self.assertEqual((tx.status, "REF-123" in tx.description), ("completed", True))
        self.assertEqual(rial(self.player), 70_000)
        self.assertTrue(told.called)
        # Closed: nothing changes it again (and no refund).
        self.assertEqual(fn.post(O + f"withdrawals/{tx.pk}/fail/", {"reason": "x"}, format="json").status_code, 409)
        self.assertEqual(rial(self.player), 70_000)

    def test_a_failed_or_cancelled_withdrawal_gives_the_money_back_once(self):
        fn = self.ops(self.finance)
        for decision in ("fail", "cancel"):
            tx = self.withdraw(40_000)
            self.assertEqual(rial(self.player), 60_000)
            self.assertEqual(fn.post(O + f"withdrawals/{tx.pk}/{decision}/", {"reason": "شبا اشتباه"}, format="json").status_code, 200)
            self.assertEqual(rial(self.player), 100_000)
            self.assertEqual(fn.post(O + f"withdrawals/{tx.pk}/{decision}/", {"reason": "again"}, format="json").status_code, 409)
            self.assertEqual(rial(self.player), 100_000)
        self.assertEqual(OpsAuditLog.objects.filter(action__in=("withdrawal_fail", "withdrawal_cancel")).count(), 2)

    def test_bank_accounts_are_approved_or_rejected_with_a_reason(self):
        pending = BankAccount.objects.create(user=self.player, iban="IR000000000000000000000002", bank=self.bank, account_holder="بازیکن")
        fn = self.ops(self.finance)
        self.assertEqual([a["id"] for a in body(fn.get(O + "bank-accounts/"))["accounts"]], [str(pending.pk)])
        self.assertEqual(fn.post(O + f"bank-accounts/{pending.pk}/reject/", {}, format="json").status_code, 400)
        self.assertEqual(fn.post(O + f"bank-accounts/{pending.pk}/approve/", {}, format="json").status_code, 200)
        pending.refresh_from_db()
        self.assertEqual(pending.status, "approved")


class SettingsAndDashboardTests(OpsTestCase):
    def test_a_setting_is_checked_applies_at_once_and_can_be_reset(self):
        own = self.ops(self.owner)
        listed = {s["key"]: s for s in body(own.get(O + "settings/"))["settings"]}
        self.assertEqual((listed["GM_ACCESS"]["value"], listed["GM_ACCESS"]["source"]), ("all", "default"))  # (OPEN patches the default)
        self.assertEqual(own.put(O + "settings/GM_ACCESS/", {"value": "everyone"}, format="json").status_code, 400)
        self.assertEqual(own.put(O + "settings/AD_REWARD_POINTS/", {"value": "-3"}, format="json").status_code, 400)
        self.assertEqual(own.put(O + "settings/NOT_A_KEY/", {"value": "1"}, format="json").status_code, 400)
        SystemConfiguration.objects.get("AD_REWARD_POINTS", 5)  # (cached now)
        r = own.put(O + "settings/AD_REWARD_POINTS/", {"value": "۱۲"}, format="json")
        self.assertEqual((r.status_code, body(r)["setting"]["value"], body(r)["setting"]["source"]), (200, 12, "database"))
        self.assertEqual(SystemConfiguration.objects.get("AD_REWARD_POINTS", 5), 12)  # applies at once
        self.assertEqual(own.put(O + "settings/GM_SMS_ENABLED/", {"value": True}, format="json").status_code, 200)
        self.assertIs(SystemConfiguration.objects.get("GM_SMS_ENABLED", False), True)
        r = own.delete(O + "settings/AD_REWARD_POINTS/")
        self.assertEqual(body(r)["setting"]["source"], "default")
        self.assertEqual(SystemConfiguration.objects.get("AD_REWARD_POINTS", 5), 5)
        logs = OpsAuditLog.objects.filter(target_id="AD_REWARD_POINTS").order_by("create_time")
        self.assertEqual([(l.action, l.data["after"]) for l in logs], [("setting_change", 12), ("setting_reset", 500)])

    def test_dashboards(self):
        own = self.ops(self.owner)
        o = body(own.get(O + "overview/"))["overview"]
        self.assertEqual(o["users"]["total"], 4)
        self.assertEqual(len(o["signups"]), 30)
        self.assertEqual(o["signups"][-1], 4)
        with mock.patch("apps.tasks.celery.app.control.ping", side_effect=OSError("no broker")):
            m = body(own.get(O + "maintenance/"))["maintenance"]
        checks = {c["name"]: c for c in m["checks"]}
        self.assertTrue(checks["database"]["ok"])
        self.assertFalse(checks["workers"]["ok"])  # shown as down, not an error
        self.assertFalse(m["ok"])
        users = body(own.get(O + "users/?q=09120001009"))["users"]
        self.assertEqual((len(users), users[0]["cash"]), (1, 100_000))
        home = body(self.ops(self.finance).get(O + "home/"))
        self.assertEqual(set(home["todo"]), {"withdrawals", "bank_accounts"})

    def test_server_errors_are_counted(self):
        from apps.ops.middleware import ErrorCountMiddleware, errors_last_24h  # pylint: disable=import-outside-toplevel

        mw = ErrorCountMiddleware(lambda request: mock.Mock(status_code=500))
        mw(None)
        mw(None)
        ErrorCountMiddleware(lambda request: mock.Mock(status_code=404))(None)
        self.assertEqual(errors_last_24h(), 2)


class CodexPass1Tests(OpsTestCase):
    """The 2026-11-09 Codex review (pass 1): each finding, reproduced."""

    def test_1_only_finance_sees_bank_details_in_a_user_card(self):
        bank = Bank.objects.create(name="ب", code="C1")
        BankAccount.objects.create(user=self.player, iban="IR000000000000000000000777", bank=bank, account_holder="صاحب", status="approved")
        support = self.staff("9120001011", ["support"])
        card = str(body(self.ops(support).get(O + "users/?q=09120001009")))
        self.assertNotIn("IR000000000000000000000777", card)
        self.assertNotIn("صاحب", card)
        self.assertIn("IR000000000000000000000777", str(body(self.ops(self.finance).get(O + "users/?q=09120001009"))))

    def test_3_logout_with_only_the_refresh_token_ends_the_session(self):
        tokens = tokens_for(self.reviewer)
        r = APIClient().post(O + "auth/logout/", {"refresh": tokens["refresh"]}, format="json")  # no access token
        self.assertEqual(r.status_code, 200)
        self.assertEqual(APIClient().post(O + "auth/refresh/", {"refresh": tokens["refresh"]}, format="json").status_code, 401)
        c = APIClient()
        c.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
        self.assertEqual(c.get(O + "me/").status_code, 401)
        self.assertTrue(OpsAuditLog.objects.filter(action="sign_out", actor=self.reviewer).exists())

    def test_4_a_bank_account_is_decided_once(self):
        bank = Bank.objects.create(name="ب", code="C2")
        a = BankAccount.objects.create(user=self.player, iban="IR000000000000000000000888", bank=bank, account_holder="x")
        fn = self.ops(self.finance)
        self.assertEqual(fn.post(O + f"bank-accounts/{a.pk}/reject/", {"reason": "نام نمی‌خواند"}, format="json").status_code, 200)
        self.assertEqual(fn.post(O + f"bank-accounts/{a.pk}/approve/", {}, format="json").status_code, 409)  # a stale page
        a.refresh_from_db()
        self.assertEqual(a.status, "rejected")

    def test_5_a_change_without_its_audit_row_does_not_happen(self):
        own = self.ops(self.owner)
        before = list(SystemConfiguration.objects.filter(key="AD_REWARD_POINTS").values_list("value", flat=True))
        with mock.patch("apps.ops.auth.OpsAuditLog.objects.create", side_effect=RuntimeError("audit down")):
            with self.assertRaises(RuntimeError):
                own.put(O + "settings/AD_REWARD_POINTS/", {"value": "7"}, format="json")
        # (a migration seeds this row: what matters is that its value did not change)
        self.assertEqual(list(SystemConfiguration.objects.filter(key="AD_REWARD_POINTS").values_list("value", flat=True)), before)
        self.assertNotIn("7", before)

    def test_7_an_sms_failure_looks_like_any_other_number(self):
        with mock.patch(SMS, return_value=None):
            staff = APIClient().post(O + "auth/send/", {"phone": "09120001001"}, format="json")
            other = APIClient().post(O + "auth/send/", {"phone": "09120001009"}, format="json")
            self.assertEqual((staff.status_code, body(staff)), (other.status_code, body(other)))
            again_staff = APIClient().post(O + "auth/send/", {"phone": "09120001001"}, format="json")
            again_other = APIClient().post(O + "auth/send/", {"phone": "09120001009"}, format="json")
            self.assertEqual((again_staff.status_code, body(again_staff)["code"]), (again_other.status_code, body(again_other)["code"]))  # both «wait»

    def test_8_a_setting_shows_the_value_the_code_uses(self):
        SystemConfiguration.objects.create(key="WALLET_MAX_NEGATIVE_CURRENCY", value="", default_value="100000", value_type="int")
        listed = {s["key"]: s for s in body(self.ops(self.owner).get(O + "settings/"))["settings"]}
        self.assertEqual(listed["WALLET_MAX_NEGATIVE_CURRENCY"]["value"], SystemConfiguration.objects.get("WALLET_MAX_NEGATIVE_CURRENCY", 0))
        self.assertEqual(listed["WALLET_MAX_NEGATIVE_CURRENCY"]["value"], 100000)

    def test_6_the_overview_works_without_its_cache(self):
        broken = mock.Mock()
        broken.get.side_effect = ConnectionError("redis down")
        broken.set.side_effect = ConnectionError("redis down")
        with mock.patch("apps.ops.views_dash.cache", broken):  # (only the overview's cache; sign-in still works)
            r = self.ops(self.owner).get(O + "overview/")
        self.assertEqual(r.status_code, 200)


class CodexPass2Tests(OpsTestCase):
    def test_1_a_stale_note_edit_never_reactivates_a_member(self):
        own = self.ops(self.owner)
        mid = str(OpsMember.objects.get(user=self.reviewer).pk)
        self.assertEqual(own.patch(O + f"staff/{mid}/", {"active": False}, format="json").status_code, 200)
        self.assertEqual(own.patch(O + f"staff/{mid}/", {"note": "یادداشت"}, format="json").status_code, 200)  # (from a stale page)
        self.assertFalse(OpsMember.objects.get(pk=mid).is_active)
        self.assertEqual(self.ops(self.reviewer).get(O + "me/").status_code, 403)

    def test_3_the_audit_shows_ibans_only_to_finance_now(self):
        bank = Bank.objects.create(name="ب", code="C3")
        a = BankAccount.objects.create(user=self.player, iban="IR000000000000000000000999", bank=bank, account_holder="x")
        self.assertEqual(self.ops(self.finance).post(O + f"bank-accounts/{a.pk}/approve/", {}, format="json").status_code, 200)
        self.assertIn("IR000000000000000000000999", str(body(self.ops(self.finance).get(O + "audit/"))))
        roles.set_roles(get_user_model().objects.get(pk=self.finance.pk), ["support"])
        shown = str(body(self.ops(self.finance).get(O + "audit/")))
        self.assertNotIn("IR000000000000000000000999", shown)
        self.assertIn("IR00…0999", shown)

    def test_4_a_failed_reset_leaves_no_cached_value(self):
        import os  # pylint: disable=import-outside-toplevel

        SystemConfiguration.objects.update_or_create(key="AD_REWARD_POINTS", defaults={"value": "5", "value_type": "int"})
        cache.clear()
        with mock.patch.dict(os.environ, {"AD_REWARD_POINTS": "99"}), mock.patch("apps.ops.auth.OpsAuditLog.objects.create", side_effect=RuntimeError("audit down")):
            with self.assertRaises(RuntimeError):
                self.ops(self.owner).delete(O + "settings/AD_REWARD_POINTS/")
            self.assertEqual(SystemConfiguration.objects.get("AD_REWARD_POINTS", 5), 5)  # (not a cached 99)


from django.test import TransactionTestCase  # noqa: E402  pylint: disable=wrong-import-position


@override_settings(CACHES=LOCMEM, OPS_OWNERS=["9128007728"])
class ConcurrentDecisionTests(TransactionTestCase):
    """Two staff decide the same withdrawal at the same moment (real PostgreSQL row locks)."""

    def test_one_decision_wins_and_the_money_moves_once(self):
        import threading  # pylint: disable=import-outside-toplevel

        from django.db import connection  # pylint: disable=import-outside-toplevel

        a = make_customer("9120002001")
        b = make_customer("9120002002")
        for u in (a, b):
            OpsMember.objects.create(user=u)
            roles.set_roles(u, ["finance"])
        player = make_customer("9120002009", rial=100_000)
        bank = Bank.objects.create(name="ب", code="CC")
        acc = BankAccount.objects.create(user=player, iban="IR000000000000000000000555", bank=bank, account_holder="x", status="approved")
        papi = APIClient()
        papi.force_authenticate(player)
        papi.post("/api/v1/wallet/currency/withdraw/", {"amount": 60_000, "bank_account_id": str(acc.pk), "request_id": str(uuid.uuid4())}, format="json")
        tx = CurrencyTransaction.objects.get()
        tokens = {u.pk: tokens_for(u)["access"] for u in (a, b)}
        barrier = threading.Barrier(2)
        codes = {}

        def decide(user, decision, payload):
            try:
                c = APIClient()
                c.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens[user.pk]}")
                barrier.wait()
                codes[decision] = c.post(O + f"withdrawals/{tx.pk}/{decision}/", payload, format="json").status_code
            finally:
                connection.close()

        with mock.patch("apps.notifications.services.queue"):
            threads = [
                threading.Thread(target=decide, args=(a, "pay", {"reference": "R1"})),
                threading.Thread(target=decide, args=(b, "fail", {"reason": "x"})),
            ]
            for t in threads:
                t.start()
            for t in threads:
                t.join()
        self.assertEqual(sorted(codes.values()), [200, 409], codes)
        tx.refresh_from_db()
        expected = 40_000 if tx.status == "completed" else 100_000
        self.assertEqual(rial(player), expected)


@override_settings(CACHES=LOCMEM, OPS_OWNERS=["9128007728"])
class CodexPass4Tests(OpsTestCase):
    """The ops re-check of 2026-11-10."""

    def test_logout_works_when_the_sign_in_bucket_is_full(self):
        tokens = tokens_for(self.finance)
        anon = APIClient()
        for _ in range(25):  # anyone's failed codes from this address fill the sign-in allowance
            anon.post(O + "auth/verify/", {"phone": "09120001009", "code": "000000"}, format="json")
        self.assertEqual(anon.post(O + "auth/verify/", {"phone": "09120001009", "code": "000000"}, format="json").status_code, 429)
        r = anon.post(O + "auth/logout/", {"refresh": tokens["refresh"]}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        cache.clear()  # (the throttle again; the revocation must hold on its own)
        self.assertEqual(APIClient().post(O + "auth/refresh/", {"refresh": tokens["refresh"]}, format="json").status_code, 401)

    def test_a_late_cache_fill_never_brings_an_old_setting_back(self):
        mgr = SystemConfiguration.objects
        SystemConfiguration.objects.update_or_create(key="TEST_STALE_FILL", defaults={"value": "5", "value_type": "int"})
        self.assertEqual(mgr.get("TEST_STALE_FILL"), 5)
        mgr.invalidate("TEST_STALE_FILL")
        generation = mgr._generation("TEST_STALE_FILL")  # pylint: disable=protected-access
        old = mgr._get_from_db("TEST_STALE_FILL")  # a reader fetched 5 …  # pylint: disable=protected-access
        row = SystemConfiguration.objects.filter(key="TEST_STALE_FILL").first()
        row.value = "7"
        row.save()  # … the admin app saves 7 (its signal clears the cache) …
        mgr.invalidate("TEST_STALE_FILL")
        mgr._set_cache("TEST_STALE_FILL", old, generation)  # … and the reader caches 5 late  # pylint: disable=protected-access
        self.assertEqual(mgr.get("TEST_STALE_FILL"), 7)


@override_settings(CACHES=LOCMEM, OPS_OWNERS=["9128007728"])
class SettingsCacheFailureTests(OpsTestCase):
    def test_a_failed_generation_move_still_drops_the_cached_value(self):
        mgr = SystemConfiguration.objects
        SystemConfiguration.objects.update_or_create(key="TEST_INVAL_FAIL", defaults={"value": "5", "value_type": "int"})
        mgr.invalidate("TEST_INVAL_FAIL")
        self.assertEqual(mgr.get("TEST_INVAL_FAIL"), 5)
        row = SystemConfiguration.objects.filter(key="TEST_INVAL_FAIL").first()
        with mock.patch("apps.configuration.models.system_configuration_manager.cache.incr", side_effect=RuntimeError("redis full")):
            row.value = "9"
            row.save()
        self.assertEqual(mgr.get("TEST_INVAL_FAIL"), 9)
        cache.set("system_config:TEST_INVAL_FAIL", 1)  # (a value older code cached during a deploy)
        mgr.invalidate("TEST_INVAL_FAIL")
        self.assertIsNone(cache.get("system_config:TEST_INVAL_FAIL"))
