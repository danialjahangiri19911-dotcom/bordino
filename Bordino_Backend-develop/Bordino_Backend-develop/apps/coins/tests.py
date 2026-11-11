from unittest import mock

from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.coins import services
from apps.coins.models import CoinPackage, CoinPurchase
from apps.configuration.models.system_configuration import SystemConfiguration
from apps.gamemaster import zibal
from apps.wallet.models.transactions.activity import ActivityTransaction
from apps.wallet.tests import make_customer, points

LOCMEM = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
C = "/api/v1/coins/"


def setting(key, value):
    SystemConfiguration.objects.update_or_create(key=key, defaults={"value": value})
    cache.clear()


def result(r):
    data = r.json()
    return data.get("result", data)


@override_settings(CACHES=LOCMEM)
class CoinTests(TestCase):
    def setUp(self):
        cache.clear()
        CoinPackage.objects.all().delete()
        self.small = CoinPackage.objects.create(coins=100, price_toman=10_000, sort_order=1)
        self.big = CoinPackage.objects.create(coins=1000, price_toman=80_000, original_price_toman=100_000, badge="پرفروش", sort_order=2)
        self.hidden = CoinPackage.objects.create(coins=5, price_toman=1_000, is_active=False)
        self.user = make_customer("9120002001", points=7)
        self.api = APIClient()
        self.api.force_authenticate(self.user)

    def buy(self, package):
        return self.api.post(C + "purchases/", {"package_id": str(package.pk)}, format="json")

    def verify(self, track, success=True, api=None):
        return (api or self.api).post(C + "purchases/verify/", {"trackId": track, "success": "1" if success else "0"}, format="json")

    def credits(self):
        return ActivityTransaction.objects.filter(section=services.SECTION).count()

    def test_packages_lists_the_active_ones_with_their_discount(self):
        r = self.api.get(C + "packages/")
        self.assertEqual(r.status_code, 200)
        body = result(r)
        self.assertEqual([p["coins"] for p in body["packages"]], [100, 1000])
        big = body["packages"][1]
        self.assertEqual((big["discount_percent"], big["original_price_toman"], big["discount_toman"]), (20, 100_000, 20_000))
        self.assertIsNone(body["packages"][0]["original_price_toman"])
        self.assertTrue(body["open"])
        self.assertEqual(body["mode"], "sandbox")
        self.assertEqual(body["balance"], 7)

    def test_sign_in_needed(self):
        self.assertEqual(APIClient().get(C + "packages/").status_code, 401)

    def test_a_sandbox_purchase_credits_its_coins_exactly_once(self):
        start = result(self.buy(self.big))
        self.assertIn("/pwa/coins/sandbox?trackId=sbx-", start["payment_url"])
        self.assertEqual((start["coins"], start["amount_toman"], start["status"]), (1000, 80_000, "pending"))
        self.assertEqual(points(self.user), 7)  # nothing before the payment is confirmed
        first = result(self.verify(start["track_id"]))
        self.assertEqual((first["status"], first["balance"]), ("paid", 1007))
        again = result(self.verify(start["track_id"]))  # a reload / a second tab
        self.assertEqual((again["status"], again["balance"]), ("paid", 1007))
        self.assertEqual(points(self.user), 1007)
        self.assertEqual(self.credits(), 1)
        purchase = CoinPurchase.objects.get(track_id=start["track_id"])
        self.assertIsNotNone(purchase.credit)
        self.assertTrue(purchase.ref_number.startswith("SANDBOX-"))

    def test_the_ledger_never_credits_one_purchase_twice(self):
        start = result(self.buy(self.small))
        purchase = CoinPurchase.objects.get(track_id=start["track_id"])
        services._credit(self.user, self.user.customer, purchase)  # pylint: disable=protected-access
        services._credit(self.user, self.user.customer, purchase)  # pylint: disable=protected-access
        self.assertEqual(self.credits(), 1)
        self.assertEqual(points(self.user), 107)

    def test_a_cancelled_payment_gives_nothing_and_stays_cancelled(self):
        start = result(self.buy(self.small))
        self.assertEqual(result(self.verify(start["track_id"], success=False))["status"], "cancelled")
        self.assertEqual(result(self.verify(start["track_id"], success=True))["status"], "cancelled")
        self.assertEqual(points(self.user), 7)
        self.assertEqual(self.credits(), 0)

    def test_an_open_purchase_is_reused_and_a_new_one_after_it_is_settled(self):
        a = result(self.buy(self.small))["track_id"]
        self.assertEqual(result(self.buy(self.small))["track_id"], a)
        self.assertNotEqual(result(self.buy(self.big))["track_id"], a)
        self.verify(a)
        self.assertNotEqual(result(self.buy(self.small))["track_id"], a)

    def test_another_players_payment_is_not_found(self):
        start = result(self.buy(self.small))
        other = make_customer("9120002002")
        api = APIClient()
        api.force_authenticate(other)
        self.assertEqual(self.verify(start["track_id"], api=api).status_code, 404)
        self.assertEqual(points(other), 0)
        self.assertEqual(self.verify("sbx-unknown").status_code, 404)

    def test_inactive_or_unknown_packages_cannot_be_bought(self):
        self.assertEqual(self.buy(self.hidden).status_code, 404)
        self.assertEqual(self.api.post(C + "purchases/", {"package_id": "nope"}, format="json").status_code, 404)

    def test_switched_off_shows_packages_but_does_not_sell(self):
        setting("COIN_ZIBAL_MODE", "off")
        self.assertFalse(result(self.api.get(C + "packages/"))["open"])
        self.assertEqual(self.buy(self.small).status_code, 409)

    def test_switching_off_after_starting_does_not_credit(self):
        start = result(self.buy(self.small))
        setting("COIN_ZIBAL_MODE", "off")
        self.assertEqual(self.verify(start["track_id"]).status_code, 502)
        self.assertEqual(points(self.user), 7)

    def test_a_package_edit_does_not_change_an_open_purchase(self):
        start = result(self.buy(self.small))
        CoinPackage.objects.filter(pk=self.small.pk).update(coins=999)
        self.assertEqual(result(self.verify(start["track_id"]))["balance"], 107)

    def test_live_mode_checks_the_amount_with_zibal(self):
        setting("COIN_ZIBAL_MODE", "live")
        setting("GM_ZIBAL_MERCHANT", "m-777")  # the coins fall back to the Game Master merchant
        with mock.patch.object(zibal, "_post") as post:
            post.return_value = {"result": 100, "trackId": 5551}
            start = result(self.buy(self.big))
            self.assertEqual(start["payment_url"], "https://gateway.zibal.ir/start/5551")
            sent = post.call_args.args[1]
            self.assertEqual((sent["merchant"], sent["amount"]), ("m-777", 800_000))
            self.assertTrue(sent["callbackUrl"].endswith("/pwa/coins/callback"))
            post.return_value = {"result": 100, "amount": 100, "refNumber": "R1"}  # a different amount
            self.assertEqual(result(self.verify("5551"))["status"], "failed")
            self.assertEqual(points(self.user), 7)
            post.return_value = {"result": 100, "trackId": 5552}
            start2 = result(self.buy(self.big))  # a new attempt
        with mock.patch.object(zibal, "_post", return_value={"result": 100, "amount": 800_000, "refNumber": "R2", "cardNumber": "6037**1234"}):
            r = result(self.verify(start2["track_id"]))
        self.assertEqual((r["status"], r["ref_number"], r["balance"]), ("paid", "R2", 1007))

    def test_live_mode_failed_payment_gives_nothing(self):
        setting("COIN_ZIBAL_MODE", "live")
        setting("COIN_ZIBAL_MERCHANT", "coin-m")
        with mock.patch.object(zibal, "_post", return_value={"result": 100, "trackId": 9001}):
            result(self.buy(self.small))
        with mock.patch.object(zibal, "_post", return_value={"result": 102}):
            self.assertEqual(result(self.verify("9001", success=False))["status"], "cancelled")
        self.assertEqual(points(self.user), 7)

    def test_package_rules(self):
        from django.core.exceptions import ValidationError  # pylint: disable=import-outside-toplevel

        for bad in (dict(coins=0, price_toman=10_000), dict(coins=10, price_toman=10), dict(coins=10, price_toman=10_000, original_price_toman=9_000), dict(coins=10, price_toman=10_000, badge="<b>")):
            with self.assertRaises(ValidationError):
                CoinPackage.objects.create(**bad)

    def test_history_names_the_purchase(self):
        start = result(self.buy(self.small))
        self.verify(start["track_id"])
        from apps.wallet.services.history import points_history  # pylint: disable=import-outside-toplevel

        rows = points_history(self.user)
        self.assertTrue(any(r["title"] == "خرید سکه" and r["amount"] == 100 for r in rows))


@override_settings(CACHES=LOCMEM, OPS_OWNERS=["9128007728"])
class OpsCoinTests(TestCase):
    def setUp(self):
        from apps.ops import roles  # pylint: disable=import-outside-toplevel
        from apps.ops.models import OpsMember  # pylint: disable=import-outside-toplevel

        cache.clear()
        CoinPackage.objects.all().delete()
        self.owner = make_customer("9128007728")
        self.reviewer = make_customer("9120003001")
        OpsMember.objects.create(user=self.reviewer, added_by=None)
        roles.set_roles(self.reviewer, ["reviewer"])

    def ops(self, user):
        from apps.ops.auth import tokens_for  # pylint: disable=import-outside-toplevel

        c = APIClient()
        c.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens_for(user)['access']}")
        return c

    def test_settings_role_manages_packages_with_an_audit_row(self):
        from apps.ops.models import OpsAuditLog  # pylint: disable=import-outside-toplevel

        api = self.ops(self.owner)
        r = api.post("/api/v1/ops/coins/packages/", {"coins": 500, "price_toman": 45_000, "original_price_toman": 50_000, "badge": "ویژه"}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        pid = result(r)["package"]["id"]
        self.assertEqual(result(r)["package"]["discount_percent"], 10)
        bad = api.put(f"/api/v1/ops/coins/packages/{pid}/", {"original_price_toman": 40_000}, format="json")
        self.assertEqual(bad.status_code, 400)
        ok = api.put(f"/api/v1/ops/coins/packages/{pid}/", {"is_active": False, "original_price_toman": ""}, format="json")
        self.assertEqual(ok.status_code, 200)
        p = CoinPackage.objects.get(pk=pid)
        self.assertEqual((p.is_active, p.original_price_toman, p.price_toman), (False, None, 45_000))
        self.assertEqual(OpsAuditLog.objects.filter(action__startswith="coin_package").count(), 2)
        self.assertEqual(api.get("/api/v1/ops/coins/purchases/").status_code, 200)

    def test_other_roles_and_players_cannot(self):
        self.assertEqual(self.ops(self.reviewer).post("/api/v1/ops/coins/packages/", {"coins": 1, "price_toman": 1000}, format="json").status_code, 403)
        player = APIClient()
        player.force_authenticate(make_customer("9120003009"))
        self.assertIn(player.get("/api/v1/ops/coins/packages/").status_code, (401, 403))

    def test_the_payment_switch_is_in_the_settings(self):
        r = self.ops(self.owner).get("/api/v1/ops/settings/")
        keys = {s["key"] for s in result(r)["settings"]}
        self.assertTrue({"COIN_ZIBAL_MODE", "COIN_ZIBAL_MERCHANT"} <= keys)

    def test_the_coin_settings_can_be_saved_and_reset(self):
        api = self.ops(self.owner)
        r = api.put("/api/v1/ops/settings/COIN_ZIBAL_MODE/", {"value": "test"}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(services.pay_mode(), "test")
        self.assertEqual(api.put("/api/v1/ops/settings/COIN_ZIBAL_MODE/", {"value": "nope"}, format="json").status_code, 400)
        self.assertEqual(api.put("/api/v1/ops/settings/COIN_ZIBAL_MERCHANT/", {"value": "m-1"}, format="json").status_code, 200)
        self.assertEqual(api.delete("/api/v1/ops/settings/COIN_ZIBAL_MODE/").status_code, 200)
        self.assertEqual(services.pay_mode(), "sandbox")
