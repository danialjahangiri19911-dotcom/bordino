from datetime import date, timedelta
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.gamemaster import budget, schema, services, starters
from apps.gamemaster.models import Game, GameAuditLog, GameBudgetLedger, GameVersion
from apps.missions import mystery as engine
from apps.missions.models import Mystery, MysteryCheckin, MysteryRun
from apps.missions.tests import LOCMEM, make_player
from apps.wallet.models import TokenWalletAccount
from apps.wallet.models.transactions.activity import ActivityTransaction

OPEN = mock.patch.dict(services.DEFAULTS, {"GM_ACCESS": "all"})


def body(r):
    data = r.json()
    return data["result"] if data["is_successful"] else data["errors"]


def quiz(points=10, budget_points=1000, **extra) -> dict:
    """A small complete game: a question, a choice, a read-only stage and a QR at a place."""
    return {
        "title": "مسابقهٔ آزمایشی",
        "summary": "s",
        "access": "public",
        "finish_points": 5,
        "budget_points": budget_points,
        "completion_message": "تمام!",
        "stages": [
            {"id": "q1", "type": "question", "title": "پرسش", "text": "متن", "question": "سال؟", "answers": ["1404"], "answer_type": "number", "points": points},
            {"id": "c1", "type": "choice", "title": "انتخاب", "question": "کدام؟", "options": ["الف", "ب"], "answers": ["ب"], "points": points},
            {"id": "m1", "type": "media", "title": "پیام", "text": "خوش آمدی", "points": 0},
            {"id": "r1", "type": "qr", "title": "فروشگاه", "text": "QR را اسکن کن", "place": {"name": "کافه آزمایش"}, "points": points, "coupon": "OFF10"},
        ],
        **extra,
    }


@override_settings(CACHES=LOCMEM)
class GameMasterTests(TestCase):
    def setUp(self):
        cache.clear()
        OPEN.start()
        self.addCleanup(OPEN.stop)
        self.creator = make_player("9120009001", points=5000)
        self.api = APIClient()
        self.api.force_authenticate(self.creator)
        self.player = make_player("9120009002")
        self.player_api = APIClient()
        self.player_api.force_authenticate(self.player)
        self.reviewer = get_user_model().objects.create_superuser(phone_number="9120009099", password="x-Pass-123")

    def points(self, user):
        return TokenWalletAccount.objects.get(wallet__owner=user).amount

    def onboard(self, api=None):
        r = (api or self.api).patch("/api/v1/gm/profile/", {"preferred_mode": "creator", "intent": "business", "accept_terms": True, "business_name": "کافه آزمایش"}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        return body(r)["profile"]

    def new_game(self, definition=None, category="business", api=None):
        r = (api or self.api).post("/api/v1/gm/games/", {"category": category}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        gid = body(r)["game"]["id"]
        if definition is not None:
            r = (api or self.api).patch(f"/api/v1/gm/games/{gid}/", {"draft": definition}, format="json")
            self.assertEqual(r.status_code, 200, r.content)
        return gid

    def act(self, gid, action, api=None):
        return (api or self.api).post(f"/api/v1/gm/games/{gid}/{action}/", {}, format="json")

    def published(self, definition=None):
        self.onboard()
        gid = self.new_game(definition or quiz())
        self.assertEqual(self.act(gid, "submit").status_code, 200)
        version = GameVersion.objects.get(game_id=gid)
        services.review(self.reviewer, version.pk, "approve")
        r = self.act(gid, "publish")
        self.assertEqual(r.status_code, 200, r.content)
        return gid, Mystery.objects.get(source_version__game_id=gid)

    # ── modes, onboarding, permissions ──

    def test_switching_to_game_master_keeps_the_account_and_the_player_side(self):
        r = self.api.get("/api/v1/gm/profile/")
        self.assertEqual((body(r)["profile"]["exists"], body(r)["profile"]["preferred_mode"]), (False, "player"))
        before = self.points(self.creator)
        p = self.onboard()
        self.assertEqual((p["preferred_mode"], p["onboarded"]), ("creator", True))
        # Same session, same account, the player side still works.
        self.assertEqual(self.api.get("/api/v1/missions/").status_code, 200)
        self.assertEqual(self.points(self.creator), before)
        self.assertEqual(get_user_model().objects.filter(phone_number="9120009001").count(), 1)
        p = body(self.api.patch("/api/v1/gm/profile/", {"preferred_mode": "player"}, format="json"))["profile"]
        self.assertEqual(p["preferred_mode"], "player")
        self.assertEqual(body(self.api.get("/api/v1/gm/profile/"))["profile"]["preferred_mode"], "player")

    def test_closed_game_master_and_onboarding_are_enforced_on_the_server(self):
        with mock.patch.dict(services.DEFAULTS, {"GM_ACCESS": "off"}):
            r = self.api.patch("/api/v1/gm/profile/", {"preferred_mode": "creator"}, format="json")
            self.assertEqual(body(r)["code"], "closed")
            self.assertEqual(self.api.get("/api/v1/gm/games/").status_code, 403)
        self.assertEqual(body(self.api.post("/api/v1/gm/games/", {"category": "business"}, format="json"))["code"], "onboarding")
        anon = APIClient()
        self.assertIn(anon.get("/api/v1/gm/games/").status_code, (401, 403))

    def test_a_creator_never_reaches_another_creators_game(self):
        self.onboard()
        gid = self.new_game(quiz())
        other = APIClient()
        other.force_authenticate(make_player("9120009003", points=100))
        self.onboard(other)
        for call in (
            lambda: other.get(f"/api/v1/gm/games/{gid}/"),
            lambda: other.patch(f"/api/v1/gm/games/{gid}/", {"draft": quiz(title="x")}, format="json"),
            lambda: other.post(f"/api/v1/gm/games/{gid}/submit/", {}, format="json"),
            lambda: other.post(f"/api/v1/gm/games/{gid}/preview/", {"stage": "q1", "answer": "1404"}, format="json"),
            lambda: other.get(f"/api/v1/gm/games/{gid}/analytics/"),
        ):
            self.assertEqual(call().status_code, 404)
        self.assertEqual(len(body(other.get("/api/v1/gm/games/"))["games"]), 0)

    # ── drafts, templates, preview ──

    def test_every_template_is_a_valid_game(self):
        for key in starters.TEMPLATES:
            definition = schema.clean(starters.definition(key))
            self.assertEqual(schema.check(definition), {}, key)
            self.assertEqual(len(schema.compile_steps(definition)), len(definition["stages"]))

    def test_drafts_autosave_and_come_back(self):
        self.onboard()
        r = self.api.post("/api/v1/gm/games/", {"category": "personal", "template": "birthday"}, format="json")
        game = body(r)["game"]
        self.assertEqual((game["draft"]["access"], len(game["draft"]["stages"])), ("private", 4))
        draft = {**game["draft"], "title": "تولد سارا", "access": "public"}
        draft["stages"][0]["answers"] = ["کافه ری‌را"]
        self.api.patch(f"/api/v1/gm/games/{game['id']}/", {"draft": draft}, format="json")
        again = body(self.api.get(f"/api/v1/gm/games/{game['id']}/"))["game"]
        self.assertEqual((again["title"], again["draft"]["stages"][0]["answers"]), ("تولد سارا", ["کافه ری‌را"]))
        self.assertEqual(again["draft"]["access"], "private")  # a personal game stays private
        self.assertEqual(self.api.patch(f"/api/v1/gm/games/{game['id']}/", {"draft": "nope"}, format="json").status_code, 400)
        huge = {**draft, "story": "x" * 70_000}
        self.assertEqual(self.api.patch(f"/api/v1/gm/games/{game['id']}/", {"draft": huge}, format="json").status_code, 400)

    def test_a_game_can_only_use_its_creators_own_uploads(self):
        from apps.gamemaster.models import GameAsset  # pylint: disable=import-outside-toplevel

        self.onboard()
        theirs = GameAsset.objects.create(owner=services.profile(make_player("9120009005"), create=True), image="gm/" + "a" * 32 + ".png")
        mine = GameAsset.objects.create(owner=services.profile(self.creator), image="gm/" + "b" * 32 + ".png")
        gid = self.new_game({**quiz(), "cover": "../../mission-proofs/x.jpg"})
        self.assertIsNone(body(self.api.get(f"/api/v1/gm/games/{gid}/"))["game"]["draft"]["cover"])  # not an upload: dropped
        self.api.patch(f"/api/v1/gm/games/{gid}/", {"draft": {**quiz(), "cover": theirs.image.name}}, format="json")
        r = self.act(gid, "submit")
        self.assertEqual((body(r)["code"], "images" in body(r)["fields"]), ("incomplete", True))
        self.api.patch(f"/api/v1/gm/games/{gid}/", {"draft": {**quiz(), "cover": mine.image.name}}, format="json")
        self.assertEqual(self.act(gid, "submit").status_code, 200)

    def test_preview_checks_stages_and_records_nothing(self):
        self.onboard()
        gid = self.new_game(quiz())
        runs, txs = MysteryRun.objects.count(), ActivityTransaction.objects.count()
        ok = body(self.api.post(f"/api/v1/gm/games/{gid}/preview/", {"stage": "q1", "answer": "۱۴۰۴"}, format="json"))
        self.assertEqual((ok["ok"], ok["points"]), (True, 10))
        bad = body(self.api.post(f"/api/v1/gm/games/{gid}/preview/", {"stage": "c1", "answer": "الف"}, format="json"))
        self.assertFalse(bad["ok"])
        qr = body(self.api.post(f"/api/v1/gm/games/{gid}/preview/", {"stage": "r1"}, format="json"))
        self.assertEqual((qr["ok"], qr["coupon"]), (True, "OFF10"))
        self.assertEqual((MysteryRun.objects.count(), ActivityTransaction.objects.count()), (runs, txs))
        self.assertFalse(Mystery.objects.exists())

    # ── review ──

    def test_a_submitted_version_is_frozen(self):
        self.onboard()
        gid = self.new_game({**quiz(), "title": ""})
        r = self.act(gid, "submit")
        self.assertEqual((r.status_code, body(r)["code"]), (400, "incomplete"))
        self.assertIn("title", body(r)["fields"])
        self.api.patch(f"/api/v1/gm/games/{gid}/", {"draft": quiz()}, format="json")
        self.assertEqual(self.act(gid, "submit").status_code, 200)
        r = self.api.patch(f"/api/v1/gm/games/{gid}/", {"draft": quiz(points=99)}, format="json")
        self.assertEqual(body(r)["code"], "locked")
        version = GameVersion.objects.get(game_id=gid)
        version.definition = {**version.definition, "title": "دستکاری"}
        with self.assertRaises(ValidationError):
            version.save()
        self.assertEqual(GameVersion.objects.get(pk=version.pk).definition["title"], "مسابقهٔ آزمایشی")

    def test_only_a_reviewer_approves_and_never_their_own_game(self):
        self.onboard()
        gid = self.new_game(quiz())
        self.act(gid, "submit")
        version = GameVersion.objects.get(game_id=gid)
        with self.assertRaises(services.GameMasterError):
            services.review(self.creator, version.pk, "approve")  # a creator is no reviewer
        # A reviewer who made the game: refused too.
        self.creator.is_superuser = True
        self.creator.save()
        with self.assertRaises(services.GameMasterError) as caught:
            services.review(self.creator, version.pk, "approve")
        self.assertEqual(caught.exception.code, "forbidden")
        self.assertEqual(GameVersion.objects.get(pk=version.pk).status, "submitted")
        # No action of the creator API approves or publishes.
        self.assertEqual(body(self.act(gid, "publish"))["code"], "not_approved")
        with self.assertRaises(services.GameMasterError):
            services.review(self.reviewer, version.pk, "reject", "")  # a reason is required
        services.review(self.reviewer, version.pk, "approve")
        self.assertEqual(Game.objects.get(pk=gid).status, "approved")
        self.assertTrue(GameAuditLog.objects.filter(game_id=gid, action="review_approve").exists())

    def test_a_rejected_game_is_revised_and_sent_again(self):
        self.onboard()
        gid = self.new_game(quiz())
        self.act(gid, "submit")
        services.review(self.reviewer, GameVersion.objects.get(game_id=gid).pk, "changes", "محل دوم امن نیست.")
        game = body(self.api.get(f"/api/v1/gm/games/{gid}/"))["game"]
        self.assertEqual((game["status"], game["latest_version"]["review_note"]), ("changes_requested", "محل دوم امن نیست."))
        self.api.patch(f"/api/v1/gm/games/{gid}/", {"draft": quiz(title="نسخهٔ اصلاح‌شده")}, format="json")
        self.assertEqual(self.act(gid, "submit").status_code, 200)
        self.assertEqual(list(GameVersion.objects.filter(game_id=gid).order_by("number").values_list("number", "status")), [(1, "changes_requested"), (2, "submitted")])

    # ── publication and play ──

    def test_only_a_published_game_reaches_players_and_it_plays_on_the_server(self):
        self.onboard()
        gid = self.new_game(quiz())
        self.act(gid, "submit")
        self.assertEqual(body(self.player_api.get("/api/v1/missions/"))["mysteries"], [])
        services.review(self.reviewer, GameVersion.objects.get(game_id=gid).pk, "approve")
        self.assertEqual(body(self.player_api.get("/api/v1/missions/"))["mysteries"], [])
        creator_before = self.points(self.creator)
        self.assertEqual(self.act(gid, "publish").status_code, 200)
        self.assertEqual(self.points(self.creator), creator_before - 1000)  # the budget, reserved
        card = body(self.player_api.get("/api/v1/missions/"))["mysteries"][0]
        self.assertEqual((card["creator"], card["presenter"], card["points"]), (True, "کافه آزمایش", 35))
        m = Mystery.objects.get(pk=card["id"])
        steps = engine.steps_of(m)
        url = f"/api/v1/missions/mysteries/{m.pk}"
        self.assertEqual(self.player_api.post(f"{url}/start/", {}, format="json").status_code, 201)
        # Out of order, or a wrong answer: refused.
        self.assertEqual(body(self.player_api.post(f"{url}/steps/{steps[1].pk}/checkin/", {"answer": "ب"}, format="json"))["code"], "not_current")
        self.assertEqual(body(self.player_api.post(f"{url}/steps/{steps[0].pk}/checkin/", {"answer": "1403"}, format="json"))["code"], "wrong")
        self.assertEqual(self.player_api.post(f"{url}/steps/{steps[0].pk}/checkin/", {"answer": "۱۴۰۴"}, format="json").status_code, 200)
        detail = body(self.player_api.get(f"{url}/"))["mystery"]
        current = detail["step_list"][1]
        self.assertEqual((current["proof"], current["options"]), ("choice", ["الف", "ب"]))
        self.assertNotIn("answers", current)
        self.player_api.post(f"{url}/steps/{steps[1].pk}/checkin/", {"answer": "ب"}, format="json")
        self.assertEqual(self.player_api.post(f"{url}/steps/{steps[2].pk}/checkin/", {}, format="json").status_code, 200)  # «ادامه»
        player_before = self.points(self.player)
        first = body(self.player_api.post(f"/api/v1/missions/qr/{steps[3].qr_token}/", {}, format="json"))
        replay = body(self.player_api.post(f"/api/v1/missions/qr/{steps[3].qr_token}/", {}, format="json"))
        self.assertEqual((first["already_rewarded"], replay["already_rewarded"]), (False, True))
        self.assertEqual(self.points(self.player), player_before + 10 + 5)  # the QR stage and the finish, once
        done = body(self.player_api.get(f"{url}/"))["mystery"]
        self.assertEqual((done["completion_message"], done["step_list"][3]["place"]["coupon"]), ("تمام!", "OFF10"))
        self.assertEqual(budget.summary(m.source_version)["spent"], 35)
        analytics = body(self.api.get(f"/api/v1/gm/games/{gid}/analytics/"))["analytics"]
        # A printed QR is counted as a scan, not a verified visit (a photo of it works anywhere).
        self.assertEqual((analytics["started"], analytics["completed"], analytics["stages"][3]["verified_visit"], analytics["stages"][3]["qr_printed"]), (1, 1, False, True))

    def test_publication_needs_enough_points_and_the_budget_caps_players(self):
        self.onboard()
        TokenWalletAccount.objects.filter(wallet__owner=self.creator).update(amount=10)
        gid = self.new_game(quiz(budget_points=35))  # exactly one player's full prize
        self.act(gid, "submit")
        services.review(self.reviewer, GameVersion.objects.get(game_id=gid).pk, "approve")
        self.assertEqual(body(self.act(gid, "publish"))["code"], "insufficient_points")
        self.assertFalse(Mystery.objects.exists())
        TokenWalletAccount.objects.filter(wallet__owner=self.creator).update(amount=100)
        self.assertEqual(self.act(gid, "publish").status_code, 200)
        self.assertEqual(self.points(self.creator), 65)
        m = Mystery.objects.get()
        self.assertEqual(self.player_api.post(f"/api/v1/missions/mysteries/{m.pk}/start/", {}, format="json").status_code, 201)
        late = APIClient()
        late.force_authenticate(make_player("9120009004"))
        r = late.post(f"/api/v1/missions/mysteries/{m.pk}/start/", {}, format="json")
        self.assertEqual(body(r)["code"], "full")  # no budget for a second player's prize

    def test_archiving_returns_what_is_left_once(self):
        gid, m = self.published()
        after_publish = self.points(self.creator)
        self.act(gid, "archive")
        self.assertEqual(self.points(self.creator), after_publish + 1000)
        self.act(gid, "archive")
        budget.release(m.source_version)
        self.assertEqual(self.points(self.creator), after_publish + 1000)
        self.assertEqual(GameBudgetLedger.objects.filter(kind="release").count(), 1)
        m.refresh_from_db()
        self.assertEqual((m.is_active, m.is_visible), (False, False))

    def test_a_private_game_opens_only_with_its_invite(self):
        gid, m = self.published(quiz(access="private"))
        self.assertEqual(body(self.player_api.get("/api/v1/missions/"))["mysteries"], [])
        self.assertEqual(self.player_api.post(f"/api/v1/missions/mysteries/{m.pk}/start/", {}, format="json").status_code, 404)
        self.assertEqual(self.player_api.post("/api/v1/missions/mysteries/invite/wrong-token/", {}, format="json").status_code, 404)
        r = self.player_api.post(f"/api/v1/missions/mysteries/invite/{m.invite_token}/", {}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(body(self.player_api.get(f"/api/v1/missions/mysteries/{m.pk}/"))["mystery"]["run"]["status"], "active")
        game = body(self.api.get(f"/api/v1/gm/games/{gid}/"))["game"]
        self.assertTrue(game["invite_url"].endswith(m.invite_token))

    def test_the_audience_is_checked_when_listing_and_starting(self):
        gid, m = self.published(quiz(audience={"age_min": 18, "age_max": 30}))
        self.assertEqual(body(self.player_api.get("/api/v1/missions/"))["mysteries"], [])  # no birthdate known
        self.assertEqual(body(self.player_api.post(f"/api/v1/missions/mysteries/{m.pk}/start/", {}, format="json"))["code"], "audience")
        customer = self.player.customer
        customer.birthdate = date.today() - timedelta(days=25 * 365)
        customer.save()
        self.assertEqual(len(body(self.player_api.get("/api/v1/missions/"))["mysteries"]), 1)
        self.assertEqual(self.player_api.post(f"/api/v1/missions/mysteries/{m.pk}/start/", {}, format="json").status_code, 201)

    def test_a_paused_game_stops_and_a_new_version_replaces_the_live_one(self):
        gid, m = self.published()
        services.set_paused(self.reviewer, gid, True, by_admin=True)
        self.assertEqual(body(self.player_api.get("/api/v1/missions/"))["mysteries"], [])
        self.assertEqual(body(self.act(gid, "resume"))["code"], "paused")  # only Bordino lifts its pause
        services.set_paused(self.reviewer, gid, False, by_admin=True)
        self.assertEqual(len(body(self.player_api.get("/api/v1/missions/"))["mysteries"]), 1)
        # A material change: a new version, reviewed; the live one keeps running until then.
        self.api.patch(f"/api/v1/gm/games/{gid}/", {"draft": quiz(points=20, budget_points=1000)}, format="json")
        self.act(gid, "submit")
        self.assertEqual(Game.objects.get(pk=gid).status, "published")
        new = GameVersion.objects.get(game_id=gid, number=2)
        services.review(self.reviewer, new.pk, "approve")
        self.act(gid, "publish")
        listed = body(self.player_api.get("/api/v1/missions/"))["mysteries"]
        self.assertEqual([c["points"] for c in listed], [65])
        m.refresh_from_db()
        self.assertFalse(m.is_visible)
        self.assertEqual(GameVersion.objects.get(game_id=gid, number=1).status, "superseded")

    def test_the_admin_review_page(self):
        self.onboard()
        gid = self.new_game(quiz())
        self.act(gid, "submit")
        version = GameVersion.objects.get(game_id=gid)
        self.client.force_login(self.reviewer)
        page = self.client.get(f"/admin/gamemaster/gameversion/{version.pk}/review/")
        self.assertEqual(page.status_code, 200)
        self.assertContains(page, "1404")  # the reviewer sees the answers
        self.assertEqual(self.client.get("/admin/gamemaster/gameversion/").status_code, 200)
        self.client.post(f"/admin/gamemaster/gameversion/{version.pk}/review/", {"decision": "approve", "note": ""})
        self.assertEqual(GameVersion.objects.get(pk=version.pk).status, "approved")
        self.assertEqual(self.client.get("/admin/gamemaster/game/").status_code, 200)
        self.assertEqual(self.client.get(f"/admin/gamemaster/game/{gid}/change/").status_code, 200)

    def test_a_timed_stage_pays_nothing_late(self):
        gid, m = self.published(quiz(stages=[{"id": "q1", "type": "question", "title": "t", "question": "q", "answers": ["a"], "points": 10, "time_limit_s": 30}], finish_points=0, budget_points=10))
        url = f"/api/v1/missions/mysteries/{m.pk}"
        self.player_api.post(f"{url}/start/", {}, format="json")
        run = MysteryRun.objects.get()
        run.step_started_at = timezone.now() - timedelta(seconds=60)
        run.save()
        r = body(self.player_api.post(f"{url}/steps/{engine.steps_of(m)[0].pk}/checkin/", {"answer": "a"}, format="json"))
        self.assertEqual((r["points"], r["finished"]), (0, True))
        self.assertEqual(MysteryCheckin.objects.get().points, 0)


@override_settings(CACHES=LOCMEM)
class GameMasterPaymentTests(TestCase):
    """Publication fees through Zibal (sandbox first), packages, SMS, the budget-low notice."""

    def setUp(self):
        cache.clear()
        self.flags = mock.patch.dict(services.DEFAULTS, {"GM_ACCESS": "all", "GM_FEE_BUSINESS_TOMAN": 50_000, "GM_INCLUDED_STAGES": 2, "GM_EXTRA_STAGE_TOMAN": 10_000})
        self.flags.start()
        self.addCleanup(self.flags.stop)
        self.creator = make_player("9120009101", points=5000)
        self.api = APIClient()
        self.api.force_authenticate(self.creator)
        self.reviewer = get_user_model().objects.create_superuser(phone_number="9120009199", password="x-Pass-123")
        self.api.patch("/api/v1/gm/profile/", {"preferred_mode": "creator", "intent": "business", "accept_terms": True, "business_name": "ک"}, format="json")
        r = self.api.post("/api/v1/gm/games/", {"category": "business"}, format="json")
        self.gid = body(r)["game"]["id"]
        self.api.patch(f"/api/v1/gm/games/{self.gid}/", {"draft": quiz()}, format="json")
        self.api.post(f"/api/v1/gm/games/{self.gid}/submit/", {}, format="json")
        self.version = GameVersion.objects.get(game_id=self.gid)
        services.review(self.reviewer, self.version.pk, "approve")

    def test_the_fee_is_set_at_approval_from_the_package_prices(self):
        self.version.refresh_from_db()
        self.assertEqual(self.version.fee_toman, 50_000 + 2 * 10_000)  # 4 stages, 2 included

    def test_publication_waits_for_payment_and_a_payment_counts_once(self):
        r = self.api.post(f"/api/v1/gm/games/{self.gid}/publish/", {}, format="json")
        self.assertEqual((r.status_code, body(r)["code"]), (402, "payment_required"))
        start = body(self.api.post(f"/api/v1/gm/games/{self.gid}/pay/", {}, format="json"))
        self.assertEqual((start["mode"], start["amount_toman"]), ("sandbox", 70_000))
        self.assertIn("/pwa/gm/pay/sandbox?trackId=sbx-", start["payment_url"])
        again = body(self.api.post(f"/api/v1/gm/games/{self.gid}/pay/", {}, format="json"))
        self.assertEqual(again["track_id"], start["track_id"])  # an open payment is reused
        # Someone else cannot confirm (or see) it.
        other = APIClient()
        other.force_authenticate(make_player("9120009102"))
        self.assertEqual(other.post("/api/v1/gm/payments/verify/", {"trackId": start["track_id"], "success": "1"}, format="json").status_code, 404)
        cancelled = body(self.api.post("/api/v1/gm/payments/verify/", {"trackId": start["track_id"], "success": "0"}, format="json"))
        self.assertEqual(cancelled["status"], "failed")
        self.assertFalse(GameVersion.objects.get(pk=self.version.pk).fee_paid)
        start = body(self.api.post(f"/api/v1/gm/games/{self.gid}/pay/", {}, format="json"))
        paid = body(self.api.post("/api/v1/gm/payments/verify/", {"trackId": start["track_id"], "success": "1"}, format="json"))
        twice = body(self.api.post("/api/v1/gm/payments/verify/", {"trackId": start["track_id"], "success": "1"}, format="json"))
        self.assertEqual((paid["status"], twice["status"]), ("paid", "paid"))
        from apps.gamemaster.models import GamePayment  # pylint: disable=import-outside-toplevel

        self.assertEqual(GamePayment.objects.filter(status="paid").count(), 1)
        self.assertTrue(GameVersion.objects.get(pk=self.version.pk).fee_paid)
        self.assertEqual(body(self.api.post(f"/api/v1/gm/games/{self.gid}/pay/", {}, format="json"))["code"], "nothing_to_pay")
        self.assertEqual(self.api.post(f"/api/v1/gm/games/{self.gid}/publish/", {}, format="json").status_code, 200)

    def test_a_live_payment_is_checked_with_zibal_and_its_amount(self):
        from apps.gamemaster import zibal  # pylint: disable=import-outside-toplevel

        with mock.patch.dict(services.DEFAULTS, {"GM_ZIBAL_MODE": "live", "GM_ZIBAL_MERCHANT": "m-123"}), mock.patch.object(zibal, "_post") as post:
            post.return_value = {"result": 100, "trackId": 777}
            start = body(self.api.post(f"/api/v1/gm/games/{self.gid}/pay/", {}, format="json"))
            self.assertEqual(start["payment_url"], "https://gateway.zibal.ir/start/777")
            sent = post.call_args.args[1]
            self.assertEqual((sent["merchant"], sent["amount"]), ("m-123", 700_000))  # rial
            post.return_value = {"result": 100, "amount": 1000, "refNumber": "R1"}  # a different amount
            self.assertEqual(body(self.api.post("/api/v1/gm/payments/verify/", {"trackId": "777", "success": "1"}, format="json"))["status"], "failed")
            post.return_value = {"result": 100, "trackId": 778}
            self.api.post(f"/api/v1/gm/games/{self.gid}/pay/", {}, format="json")
            post.return_value = {"result": 100, "amount": 700_000, "refNumber": "R2", "cardNumber": "6037****1234"}
            paid = body(self.api.post("/api/v1/gm/payments/verify/", {"trackId": "778", "success": "1"}, format="json"))
            self.assertEqual((paid["status"], paid["ref_number"]), ("paid", "R2"))

    def test_sms_goes_out_only_when_switched_on(self):
        with mock.patch.object(services, "send_sms") as sms:
            services._notify(Game.objects.get(pk=self.gid), "t", "b", "GM_SMS_TEMPLATE_APPROVED")
            sms.assert_not_called()
            with mock.patch.dict(services.DEFAULTS, {"GM_SMS_ENABLED": True}):
                services._notify(Game.objects.get(pk=self.gid), "t", "b", "GM_SMS_TEMPLATE_APPROVED")
            sms.assert_called_once()
            self.assertEqual(sms.call_args.args[1], "gmApproved")

    def test_the_creator_is_told_once_when_the_budget_runs_low(self):
        with mock.patch.dict(services.DEFAULTS, {"GM_FEE_BUSINESS_TOMAN": 0}):
            r = self.api.post(f"/api/v1/gm/games/{self.gid}/pay/", {}, format="json")
            GameVersion.objects.filter(pk=self.version.pk).update(fee_paid=True)
            self.assertEqual(self.api.post(f"/api/v1/gm/games/{self.gid}/publish/", {}, format="json").status_code, 200)
        m = Mystery.objects.get()  # budget 1000 / 35 per player = 28 players
        for n in range(27):
            p = make_player(f"91200092{n:02d}")
            MysteryRun.objects.create(customer=p.customer, mystery=m, step_started_at=timezone.now())
        player = make_player("9120009299")
        api = APIClient()
        api.force_authenticate(player)
        api.post(f"/api/v1/missions/mysteries/{m.pk}/start/", {}, format="json")
        api.post(f"/api/v1/missions/mysteries/{m.pk}/steps/{engine.steps_of(m)[0].pk}/checkin/", {"answer": "1404"}, format="json")
        api.post(f"/api/v1/missions/mysteries/{m.pk}/steps/{engine.steps_of(m)[1].pk}/checkin/", {"answer": "ب"}, format="json")
        self.assertEqual(GameAuditLog.objects.filter(game_id=self.gid, action="budget_low").count(), 1)



@override_settings(CACHES=LOCMEM)
class GameMasterAuditTests(TestCase):
    """The 2026-11-08 audit: choice guessing, budget left behind, ended games, uploads, QR proof."""

    def setUp(self):
        cache.clear()
        OPEN.start()
        self.addCleanup(OPEN.stop)
        self.creator = make_player("9120009301", points=5000)
        self.api = APIClient()
        self.api.force_authenticate(self.creator)
        self.player = make_player("9120009302")
        self.player_api = APIClient()
        self.player_api.force_authenticate(self.player)
        self.reviewer = get_user_model().objects.create_superuser(phone_number="9120009399", password="x-Pass-123")
        self.api.patch("/api/v1/gm/profile/", {"preferred_mode": "creator", "intent": "pro", "accept_terms": True, "business_name": "ک"}, format="json")

    def points(self, user):
        return TokenWalletAccount.objects.get(wallet__owner=user).amount

    def publish(self, definition, gid=None):
        if gid is None:
            gid = body(self.api.post("/api/v1/gm/games/", {"category": "pro"}, format="json"))["game"]["id"]
        self.api.patch(f"/api/v1/gm/games/{gid}/", {"draft": definition}, format="json")
        self.assertEqual(self.api.post(f"/api/v1/gm/games/{gid}/submit/", {}, format="json").status_code, 200)
        services.review(self.reviewer, GameVersion.objects.filter(game_id=gid).order_by("-number").first().pk, "approve")
        self.assertEqual(self.api.post(f"/api/v1/gm/games/{gid}/publish/", {}, format="json").status_code, 200)
        return gid, Game.objects.get(pk=gid).live_version.mystery

    def test_guessing_every_option_of_a_choice_pays_nothing(self):
        gid, m = self.publish(quiz())
        url = f"/api/v1/missions/mysteries/{m.pk}"
        self.player_api.post(f"{url}/start/", {}, format="json")
        steps = engine.steps_of(m)
        self.player_api.post(f"{url}/steps/{steps[0].pk}/checkin/", {"answer": "1404"}, format="json")
        wrong = body(self.player_api.post(f"{url}/steps/{steps[1].pk}/checkin/", {"answer": "الف"}, format="json"))
        self.assertIn("امتیاز این مرحله از دست رفت", wrong["error"])
        current = body(self.player_api.get(f"{url}/"))["mystery"]["step_list"][1]
        self.assertEqual(current["points_now"], 0)
        r = body(self.player_api.post(f"{url}/steps/{steps[1].pk}/checkin/", {"answer": "ب"}, format="json"))
        self.assertEqual(r["points"], 0)  # solved, the next stage opens, no points
        self.assertEqual(body(self.player_api.get(f"{url}/"))["mystery"]["step_list"][2]["state"], "current")

    def test_points_held_for_players_of_a_replaced_version_come_back_at_the_end(self):
        start = self.points(self.creator)
        gid, old = self.publish(quiz())
        self.player_api.post(f"/api/v1/missions/mysteries/{old.pk}/start/", {}, format="json")  # starts, then stops playing
        self.publish(quiz(points=20), gid=gid)  # v2 replaces v1: v1's free budget back, the player's 35 held
        self.assertEqual(self.points(self.creator), start - 1000 - 1000 + 965)
        self.api.post(f"/api/v1/gm/games/{gid}/archive/", {}, format="json")
        self.assertEqual(self.points(self.creator), start)  # everything back: the held 35 too
        self.assertEqual(GameBudgetLedger.objects.filter(kind="release").count(), 3)

    def test_an_ended_game_is_settled_when_its_creator_looks(self):
        start = self.points(self.creator)
        gid, m = self.publish(quiz())
        Mystery.objects.filter(pk=m.pk).update(ends_at=timezone.now() - timedelta(minutes=1))
        listed = body(self.api.get("/api/v1/gm/games/"))["games"][0]
        self.assertEqual(listed["status"], "expired")  # ended: not archived, its history kept
        self.assertEqual(self.points(self.creator), start)

    def test_a_scheduled_game_shows_published_once_it_starts(self):
        later = (timezone.now() + timedelta(hours=1)).isoformat()
        gid, m = self.publish(quiz(starts_at=later))
        self.assertEqual(Game.objects.get(pk=gid).status, "scheduled")
        Mystery.objects.filter(pk=m.pk).update(starts_at=timezone.now() - timedelta(minutes=1))
        self.assertEqual(body(self.api.get(f"/api/v1/gm/games/{gid}/"))["game"]["status"], "published")

    def test_uploads_are_capped(self):
        from apps.gamemaster.models import GameAsset  # pylint: disable=import-outside-toplevel
        from apps.missions.tests import png  # pylint: disable=import-outside-toplevel

        GameAsset.objects.create(owner=services.profile(self.creator), image="gm/" + "c" * 32 + ".png")  # today's one
        with mock.patch.dict(services.DEFAULTS, {"GM_MAX_UPLOADS_PER_DAY": 1}):
            r = self.api.post("/api/v1/gm/uploads/", {"image": png()}, format="multipart")
            self.assertEqual(body(r)["code"], "limit")  # refused before anything is stored
        self.assertEqual(GameAsset.objects.count(), 1)

    def test_choice_options_must_differ(self):
        d = quiz()
        d["stages"][1]["options"] = ["ب", "ب"]
        self.assertIn("stages.1.options", schema.check(d))

    def test_a_venue_screen_qr_is_the_verified_visit(self):
        d = quiz()
        d["stages"][3]["qr_rotating"] = True
        gid, m = self.publish(d)
        step = engine.steps_of(m)[3]
        self.assertTrue(step.qr_rotating and step.qr_display_key)
        qr = body(self.api.get(f"/api/v1/gm/games/{gid}/qr/"))["qr"][0]
        self.assertEqual((qr["svg"], qr["venue_url"].endswith(step.qr_display_key)), ("", True))
        # The printed token does not work for a venue-screen stage.
        url = f"/api/v1/missions/mysteries/{m.pk}"
        self.player_api.post(f"{url}/start/", {}, format="json")
        steps = engine.steps_of(m)
        self.player_api.post(f"{url}/steps/{steps[0].pk}/checkin/", {"answer": "1404"}, format="json")
        self.player_api.post(f"{url}/steps/{steps[1].pk}/checkin/", {"answer": "ب"}, format="json")
        self.player_api.post(f"{url}/steps/{steps[2].pk}/checkin/", {}, format="json")
        self.assertEqual(body(self.player_api.post(f"/api/v1/missions/qr/{step.qr_token}/", {}, format="json"))["code"], "qr_expired")
        from apps.missions import services as mission_services  # pylint: disable=import-outside-toplevel

        code, _ = mission_services.display_code(step)
        self.assertEqual(self.player_api.post(f"/api/v1/missions/qr/{code}/", {}, format="json").status_code, 200)
        a = body(self.api.get(f"/api/v1/gm/games/{gid}/analytics/"))["analytics"]["stages"][3]
        self.assertEqual((a["verified_visit"], a["qr_printed"]), (True, False))

    def test_the_invite_link_exists_from_the_first_draft_and_lasts_across_versions(self):
        gid = body(self.api.post("/api/v1/gm/games/", {"category": "personal"}, format="json"))["game"]["id"]
        self.api.patch(f"/api/v1/gm/games/{gid}/", {"draft": quiz(access="private")}, format="json")
        share = body(self.api.get(f"/api/v1/gm/games/{gid}/share/"))
        self.assertEqual((share["kind"], share["active"]), ("invite", False))
        self.assertIn("/pwa/play/", share["url"])
        self.assertTrue(share["svg"].startswith("<svg"))
        token = share["url"].rsplit("/", 1)[-1]
        self.assertEqual(self.player_api.post(f"/api/v1/missions/mysteries/invite/{token}/", {}, format="json").status_code, 404)  # not yet
        gid, m = self.publish(quiz(access="private"), gid=gid)
        self.assertTrue(body(self.api.get(f"/api/v1/gm/games/{gid}/share/"))["active"])
        self.assertEqual(self.player_api.post(f"/api/v1/missions/mysteries/invite/{token}/", {}, format="json").status_code, 200)
        gid, m2 = self.publish(quiz(access="private", points=20), gid=gid)  # a new version: the same link
        m.refresh_from_db()
        self.assertEqual((m2.invite_token, m.invite_token), (token, None))
        late = APIClient()
        late.force_authenticate(make_player("9120009305"))
        joined = body(late.post(f"/api/v1/missions/mysteries/invite/{token}/", {}, format="json"))["mystery"]
        self.assertEqual(joined["id"], str(m2.pk))  # newcomers get the new version
        self.api.post(f"/api/v1/gm/games/{gid}/archive/", {}, format="json")
        self.assertFalse(body(self.api.get(f"/api/v1/gm/games/{gid}/share/"))["active"])

    def test_a_public_game_shares_its_page_once_published(self):
        gid = body(self.api.post("/api/v1/gm/games/", {"category": "pro"}, format="json"))["game"]["id"]
        self.api.patch(f"/api/v1/gm/games/{gid}/", {"draft": quiz()}, format="json")
        self.assertEqual(body(self.api.get(f"/api/v1/gm/games/{gid}/share/"))["url"], "")
        gid, m = self.publish(quiz(), gid=gid)
        share = body(self.api.get(f"/api/v1/gm/games/{gid}/share/"))
        self.assertEqual((share["kind"], share["active"], share["url"].endswith(f"/pwa/earn/mystery/{m.pk}")), ("public", True, True))


@override_settings(CACHES=LOCMEM)
class GameMasterLeaderboardTests(TestCase):
    """Leaderboards, presets and expiry (the 2026-11-08 leaderboard spec)."""

    def setUp(self):
        cache.clear()
        OPEN.start()
        self.addCleanup(OPEN.stop)
        self.creator = make_player("9120009401", points=20000)
        self.api = APIClient()
        self.api.force_authenticate(self.creator)
        self.reviewer = get_user_model().objects.create_superuser(phone_number="9120009499", password="x-Pass-123")
        self.api.patch("/api/v1/gm/profile/", {"preferred_mode": "creator", "intent": "pro", "accept_terms": True, "business_name": "ک"}, format="json")
        self.n = 0

    def player(self, name=None):
        self.n += 1
        user = make_player(f"91200094{self.n:02d}" if self.n > 1 else "9120009451")
        if name:
            get_user_model().objects.filter(pk=user.pk).update(username=name)
        api = APIClient()
        api.force_authenticate(user)
        return api

    def publish(self, definition, gid=None, new_edition=False, category="pro"):
        if gid is None:
            gid = body(self.api.post("/api/v1/gm/games/", {"category": category}, format="json"))["game"]["id"]
        r = self.api.patch(f"/api/v1/gm/games/{gid}/", {"draft": definition}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        r = self.api.post(f"/api/v1/gm/games/{gid}/submit/", {}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        services.review(self.reviewer, GameVersion.objects.filter(game_id=gid).order_by("-number").first().pk, "approve")
        r = self.api.post(f"/api/v1/gm/games/{gid}/publish/", {"new_edition": new_edition}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        return gid, Game.objects.get(pk=gid).live_version.mystery

    def play(self, api, m, upto=4, wait=None):
        url = f"/api/v1/missions/mysteries/{m.pk}"
        r = api.post(f"{url}/start/", {}, format="json")
        steps = engine.steps_of(m)
        moves = [{"answer": "1404"}, {"answer": "ب"}, {}]
        for i, step in enumerate(steps[:upto]):
            if wait:
                wait()
            if i < 3:
                api.post(f"{url}/steps/{step.pk}/checkin/", moves[i], format="json")
            else:
                api.post(f"/api/v1/missions/qr/{step.qr_token}/", {}, format="json")
        return r

    def board(self, api, m, **params):
        cache.clear()
        q = "&".join(f"{k}={v}" for k, v in params.items())
        return body(api.get(f"/api/v1/missions/mysteries/{m.pk}/leaderboard/?{q}"))["board"]

    # 1, 2: no leaderboard is a full option, progress is tracked all the same
    def test_a_game_without_a_leaderboard_publishes_and_still_tracks_progress(self):
        gid, m = self.publish(quiz())
        p = self.player()
        self.play(p, m, upto=2)
        b = self.board(p, m)
        self.assertEqual((b["enabled"], b["visible"]), (False, False))
        self.assertNotIn("rows", b)
        self.assertFalse(body(p.get(f"/api/v1/missions/mysteries/{m.pk}/"))["mystery"]["leaderboard"]["enabled"])
        a = body(self.api.get(f"/api/v1/gm/games/{gid}/analytics/"))["analytics"]
        self.assertEqual((a["enrolled"], a["started_playing"], a["completed_players"], a["stage_completions"]), (1, 1, 0, 2))
        self.assertEqual(a["average_progress"], 50)
        self.assertEqual(a["drop_off"][:2], [0, 0])

    # 3-6: presets, their defaults, customizing, restoring
    def test_presets_apply_their_defaults_and_can_be_customized_and_restored(self):
        from apps.missions import leaderboard as boards  # pylint: disable=import-outside-toplevel

        speed = boards.clean({"preset": "speed"})
        self.assertEqual((speed["rank_by"], speed["only_finishers"], speed["show"]["time"]), (["duration", "score"], True, True))
        self.assertEqual(boards.clean({"preset": "score"})["rank_by"], ["score", "stages", "duration"])
        custom = boards.clean({"preset": "progress", "customized": True, "rank_by": ["score"], "top": 3, "visibility": "finishers"})
        self.assertEqual((custom["preset"], custom["rank_by"], custom["top"], custom["visibility"]), ("progress", ["score"], 3, "finishers"))
        # «Restore defaults» = not customized: whatever else was sent, the preset's own rules.
        restored = boards.clean({**custom, "customized": False})
        self.assertEqual(restored, boards.preset_config("progress"))
        self.assertEqual(boards.clean({"preset": "none"}), {"preset": "none"})
        # Contradictions and what is not offered yet are refused.
        self.assertIn("leaderboard.only_finishers", boards.problems(boards.clean({"preset": "speed", "customized": True, "rank_by": ["duration"], "only_finishers": False})))
        self.assertIn("leaderboard.rank_by", boards.problems(boards.clean({"preset": "progress", "customized": True, "rank_by": ["stages", "progress"]})))
        self.assertIn("leaderboard.period", boards.problems(boards.clean({"preset": "score", "customized": True, "period": "weekly"})))
        self.assertIn("leaderboard.preset", boards.problems(boards.clean({"preset": "team"})))
        # The quiz template suggests a board; a business game starts without one, 30 days long.
        gid = body(self.api.post("/api/v1/gm/games/", {"category": "pro", "template": "quiz"}, format="json"))["game"]["id"]
        draft = body(self.api.get(f"/api/v1/gm/games/{gid}/"))["game"]["draft"]
        self.assertEqual((draft["leaderboard"]["preset"], draft["availability"]["duration_value"]), ("score", 7))
        gid = body(self.api.post("/api/v1/gm/games/", {"category": "business"}, format="json"))["game"]["id"]
        draft = body(self.api.get(f"/api/v1/gm/games/{gid}/"))["game"]["draft"]
        self.assertEqual((draft["leaderboard"]["preset"], draft["availability"]["expiry"], draft["availability"]["duration_value"]), ("none", "duration", 30))
        gid = body(self.api.post("/api/v1/gm/games/", {"category": "pro", "template": "city_hunt"}, format="json"))["game"]["id"]
        self.assertEqual(body(self.api.get(f"/api/v1/gm/games/{gid}/"))["game"]["draft"]["availability"]["expiry"], "none")

    # 8, 10, 11: server-side counts, my row, deterministic order
    def test_the_board_ranks_on_the_server_deterministically_and_shows_my_row(self):
        gid, m = self.publish(quiz(leaderboard={"preset": "progress", "customized": True, "rank_by": ["stages", "score"], "top": 3, "full": False}))
        players = [self.player(f"p{i}") for i in range(5)]
        for i, (api, upto) in enumerate(zip(players, (4, 2, 2, 1, 0))):
            self.play(api, m, upto=upto)
        b = self.board(players[3], m)
        self.assertEqual([r["position"] for r in b["rows"]], [1, 2, 3])
        self.assertEqual((b["rows"][0]["stages"], b["rows"][0]["completed"], b["count"], b["more"]), (4, True, 3, False))
        # Two players on 2 stages with the same points: the one who got there first is ahead.
        self.assertEqual([r["stages"] for r in b["rows"]][1:], [2, 2])
        self.assertEqual((b["me"]["position"], b["me"]["stages"], b["me"]["is_me"]), (4, 1, True))  # outside the top 3, still shown
        self.assertEqual(b["totals"], {"players": 5, "finishers": 1, "stages": 4})
        self.assertEqual(self.board(players[3], m), b)  # the same order every time
        # A stage proved again counts once.
        step = engine.steps_of(m)[0]
        players[3].post(f"/api/v1/missions/mysteries/{m.pk}/steps/{step.pk}/checkin/", {"answer": "1404"}, format="json")
        self.assertEqual(self.board(players[3], m)["me"]["stages"], 1)
        # A player who has not proved a stage is not ranked, but sees their progress.
        self.assertIsNone(self.board(players[4], m)["me"])
        self.assertEqual(self.board(players[4], m)["my_progress"], {"stages": 0, "completed": False})
        # Someone not playing does not see it; the creator sees every row.
        self.assertEqual(self.board(self.player(), m)["reason"], "not_playing")
        self.assertEqual(len(body(self.api.get(f"/api/v1/gm/games/{gid}/leaderboard/"))["board"]["rows"]), 4)

    # 9: privacy
    def test_names_and_pictures_follow_the_players_own_choice(self):
        gid, m = self.publish(quiz(leaderboard={"preset": "score"}))
        ali, sara = self.player("ali"), self.player("sara")
        self.play(ali, m, upto=2)
        self.play(sara, m, upto=1)
        row = self.board(sara, m)["rows"][0]
        self.assertEqual((row["name"], row["avatar"], row["is_me"]), ("a***", None, False))
        self.assertEqual(self.board(ali, m)["rows"][0]["name"], "ali")  # their own row: their name
        ali.post(f"/api/v1/missions/mysteries/{m.pk}/leaderboard/identity/", {"show": True}, format="json")
        self.assertEqual(self.board(sara, m)["rows"][0]["name"], "ali")
        # The creator cannot turn it on for a player (no such setting on the creator side).
        self.assertEqual(body(self.api.get(f"/api/v1/gm/games/{gid}/leaderboard/"))["board"]["rows"][1]["name"], "s***")

    def test_who_may_see_the_board(self):
        gid, m = self.publish(quiz(leaderboard={"preset": "score", "customized": True, "visibility": "finishers", "after": "hide"}))
        done, halfway = self.player("a"), self.player("b")
        self.play(done, m)
        self.play(halfway, m, upto=1)
        self.assertTrue(self.board(done, m)["visible"])
        self.assertEqual(self.board(halfway, m)["reason"], "finish_first")
        Mystery.objects.filter(pk=m.pk).update(ends_at=timezone.now() - timedelta(minutes=1))
        self.assertEqual(self.board(done, m)["reason"], "hidden")  # after the end: hidden from players
        self.assertTrue(body(self.api.get(f"/api/v1/gm/games/{gid}/leaderboard/"))["board"]["visible"])  # not from the creator

    # 7, 20: editions
    def test_each_edition_has_its_own_players_and_board_and_versions_share_one(self):
        gid, m1 = self.publish(quiz(leaderboard={"preset": "progress"}))
        a = self.player("a")
        self.play(a, m1, upto=2)
        # A new version of the same edition: the player keeps their game (no second run, no
        # second reward); the board carries on.
        gid, m2 = self.publish(quiz(points=20, leaderboard={"preset": "progress"}), gid=gid)
        started = body(a.post(f"/api/v1/missions/mysteries/{m2.pk}/start/", {}, format="json"))["mystery"]
        self.assertEqual(started["id"], str(m1.pk))
        self.assertEqual(MysteryRun.objects.filter(customer__user__username="a").count(), 1)
        listed = [x["id"] for x in body(a.get("/api/v1/missions/"))["mysteries"]] if "mysteries" in body(a.get("/api/v1/missions/")) else None
        if listed is not None:
            self.assertIn(str(m1.pk), listed)
            self.assertNotIn(str(m2.pk), listed)
        b = self.player("b")
        self.play(b, m2, upto=1)
        self.assertEqual([r["stages"] for r in self.board(a, m2)["rows"]], [2, 1])
        # A new edition: a fresh board and everyone may play again.
        gid, m3 = self.publish(quiz(leaderboard={"preset": "progress"}), gid=gid, new_edition=True)
        self.assertEqual((m3.edition, Game.objects.get(pk=gid).edition), (2, 2))
        self.assertEqual(self.board(self.player(), m3)["totals"]["players"], 0)
        self.play(a, m3, upto=1)
        self.assertEqual([r["stages"] for r in self.board(a, m3)["rows"]], [1])
        self.assertEqual([r["stages"] for r in self.board(a, m1)["rows"]], [2, 1])  # the old edition as it was

    # 12, 13, 15: expiry on the server, timer or not
    def test_an_expired_game_takes_nobody_new_and_strict_expiry_stops_progress(self):
        gid, m = self.publish(quiz())
        a = self.player()
        self.play(a, m, upto=1)
        Mystery.objects.filter(pk=m.pk).update(ends_at=timezone.now() - timedelta(seconds=1))  # no timer ran
        late = self.player()
        self.assertEqual(body(late.post(f"/api/v1/missions/mysteries/{m.pk}/start/", {}, format="json"))["code"], "expired")
        step = engine.steps_of(m)[1]
        self.assertEqual(body(a.post(f"/api/v1/missions/mysteries/{m.pk}/steps/{step.pk}/checkin/", {"answer": "ب"}, format="json"))["code"], "expired")
        self.assertEqual(Game.objects.get(pk=gid).status, "published")  # (the stored status is the timer's job)
        services.tick()
        self.assertEqual(Game.objects.get(pk=gid).status, "expired")
        # Hidden from discovery, still the player's own.
        self.assertEqual(late.get(f"/api/v1/missions/mysteries/{m.pk}/").status_code, 404)
        self.assertEqual(body(a.get(f"/api/v1/missions/mysteries/{m.pk}/"))["mystery"]["done"], 1)

    # 14: the grace to finish
    def test_players_who_started_may_finish_within_the_grace(self):
        gid, m = self.publish(quiz(availability={"expiry": "duration", "duration_value": 1, "duration_unit": "days", "after": "finish", "grace_hours": 24}))
        self.assertEqual(m.grace_ends_at - m.ends_at, timedelta(hours=24))
        a = self.player()
        self.play(a, m, upto=1)
        Mystery.objects.filter(pk=m.pk).update(ends_at=timezone.now() - timedelta(minutes=1), grace_ends_at=timezone.now() + timedelta(hours=1))
        self.assertEqual(body(self.player().post(f"/api/v1/missions/mysteries/{m.pk}/start/", {}, format="json"))["code"], "expired")
        step = engine.steps_of(m)[1]
        self.assertEqual(a.post(f"/api/v1/missions/mysteries/{m.pk}/steps/{step.pk}/checkin/", {"answer": "ب"}, format="json").status_code, 200)
        self.assertEqual(body(a.get(f"/api/v1/missions/mysteries/{m.pk}/"))["mystery"]["in_grace"], True)
        services.tick()
        self.assertEqual(Game.objects.get(pk=gid).status, "expired")
        from apps.missions.models import LeaderboardSnapshot  # pylint: disable=import-outside-toplevel

        self.assertFalse(LeaderboardSnapshot.objects.exists())  # not final while players may still finish
        self.assertEqual(GameBudgetLedger.objects.filter(kind="release").count(), 0)  # nor the budget back
        Mystery.objects.filter(pk=m.pk).update(grace_ends_at=timezone.now() - timedelta(seconds=1))
        step = engine.steps_of(m)[2]
        self.assertEqual(body(a.post(f"/api/v1/missions/mysteries/{m.pk}/steps/{step.pk}/checkin/", {}, format="json"))["code"], "expired")

    # 16, 17: durations count from the publication, months are calendar months on Tehran's clock
    def test_durations_count_from_publication_in_calendar_months(self):
        zone = schema.ZONE
        d = schema.clean(quiz(availability={"expiry": "duration", "duration_value": 1, "duration_unit": "months"}))
        for start, end in (((2026, 11, 10), (2026, 12, 10)), ((2027, 1, 31), (2027, 2, 28)), ((2028, 1, 31), (2028, 2, 29))):
            published = timezone.datetime(*start, 18, 30, tzinfo=zone)
            got, grace = schema.end_times(d, published)
            self.assertEqual((got.astimezone(zone).date(), got.astimezone(zone).hour, got.astimezone(zone).minute, grace), (date(*end), 18, 30, None))
        from datetime import timezone as dt_timezone  # pylint: disable=import-outside-toplevel

        published = timezone.datetime(2026, 11, 10, 23, 0, tzinfo=dt_timezone.utc)  # 02:30 on the 11th in Tehran
        got, _ = schema.end_times(d, published)
        self.assertEqual(got.astimezone(zone).date(), date(2026, 12, 11))
        before = timezone.now()
        gid, m = self.publish(quiz(availability={"expiry": "duration", "duration_value": 3, "duration_unit": "days"}))
        self.assertTrue(before + timedelta(days=3) <= m.ends_at <= timezone.now() + timedelta(days=3))

    # 18, 19: history and the final result stay
    def test_history_money_and_the_final_result_are_kept_and_corrections_are_audited(self):
        from apps.missions.models import LeaderboardSnapshot  # pylint: disable=import-outside-toplevel

        start = self.points(self.creator)
        gid, m = self.publish(quiz(leaderboard={"preset": "score"}))
        a, b = self.player("a"), self.player("b")
        self.play(a, m)
        self.play(b, m, upto=1)
        paid = set(ActivityTransaction.objects.values_list("pk", flat=True))
        Mystery.objects.filter(pk=m.pk).update(ends_at=timezone.now() - timedelta(seconds=1))
        services.tick()
        services.tick()  # (again: nothing happens twice)
        self.assertEqual((MysteryRun.objects.count(), MysteryCheckin.objects.count()), (2, 5))
        after = set(ActivityTransaction.objects.values_list("pk", flat=True))
        self.assertTrue(paid < after and len(after - paid) == 1)  # every payment kept; one refund of the rest
        self.assertEqual(LeaderboardSnapshot.objects.count(), 1)
        first = LeaderboardSnapshot.objects.get()
        self.assertEqual([r["name"] for r in first.rows], ["a", "b"])
        spent = budget.summary(m.source_version)["spent"]
        self.assertEqual(self.points(self.creator), start - spent)  # the rest came back, once
        with self.assertRaises(ValueError):
            first.save()
        # Bordino takes a run off: a new snapshot, the old one kept, the action in the audit log.
        services.exclude_run(self.reviewer, MysteryRun.objects.get(customer__user__username="a").pk, "تقلب")
        self.assertEqual(LeaderboardSnapshot.objects.count(), 2)
        newest = LeaderboardSnapshot.objects.order_by("-create_time").first()
        self.assertEqual(([r["name"] for r in newest.rows], newest.replaces_id), (["b"], first.pk))
        self.assertTrue(GameAuditLog.objects.filter(game_id=gid, action="leaderboard_exclude").exists())
        b_board = self.board(b, m)
        self.assertEqual((b_board["final"], b_board["rows"][0]["position"]), (True, 1))
        with self.assertRaises(services.GameMasterError):
            services.exclude_run(self.creator, MysteryRun.objects.first().pk, "x")  # creators cannot

    # 21: material settings change only through review
    def test_changing_the_rules_of_a_live_game_needs_a_new_review(self):
        gid, m = self.publish(quiz(leaderboard={"preset": "score"}))
        self.api.patch(f"/api/v1/gm/games/{gid}/", {"draft": quiz(leaderboard={"preset": "speed"}, availability={"expiry": "duration", "duration_value": 2})}, format="json")
        m.refresh_from_db()
        self.assertEqual((m.leaderboard["preset"], m.ends_at), ("score", None))
        self.assertEqual(self.api.post(f"/api/v1/gm/games/{gid}/publish/", {}, format="json").status_code, 409)  # nothing approved
        from apps.missions.admin import MysteryAdmin  # pylint: disable=import-outside-toplevel

        self.assertTrue({"leaderboard", "ends_at", "grace_ends_at", "edition"} <= set(MysteryAdmin.CREATOR_LOCKED))

    def test_bordinos_limits_apply_and_an_extension_is_reviewed(self):
        with mock.patch.dict(services.DEFAULTS, {"GM_MAX_DAYS_PRO": 14}):
            gid = body(self.api.post("/api/v1/gm/games/", {"category": "pro"}, format="json"))["game"]["id"]
            self.api.patch(f"/api/v1/gm/games/{gid}/", {"draft": quiz()}, format="json")
            problems = body(self.api.get(f"/api/v1/gm/games/{gid}/"))["game"]["problems"]
            self.assertIn("availability.expiry", problems)  # «no end» is not allowed under a limit
            self.api.patch(f"/api/v1/gm/games/{gid}/", {"draft": quiz(availability={"expiry": "duration", "duration_value": 1, "duration_unit": "months"})}, format="json")
            self.assertIn("availability.expiry", body(self.api.get(f"/api/v1/gm/games/{gid}/"))["game"]["problems"])
            gid, m = self.publish(quiz(availability={"expiry": "duration", "duration_value": 7}), gid=gid)
        # Extending: a new version (reviewed) with a later end; the edition goes on.
        Mystery.objects.filter(pk=m.pk).update(ends_at=timezone.now() - timedelta(seconds=1))
        a = self.player()
        services.settle(Game.objects.get(pk=gid))
        self.assertEqual(body(self.api.get(f"/api/v1/gm/games/{gid}/"))["game"]["next_publish"], "new_only")
        gid, m2 = self.publish(quiz(availability={"expiry": "duration", "duration_value": 7}), gid=gid)
        self.assertEqual((Game.objects.get(pk=gid).status, m2.edition), ("published", 2))  # the ended edition stays closed
        self.assertEqual(a.post(f"/api/v1/missions/mysteries/{m2.pk}/start/", {}, format="json").status_code, 201)

    def test_ending_soon_is_told_once(self):
        gid, m = self.publish(quiz(availability={"expiry": "duration", "duration_value": 10}))
        with mock.patch.object(services, "_notify") as told:
            later = m.ends_at - timedelta(days=6)
            services.tick(later)
            services.tick(later + timedelta(minutes=10))
            self.assertEqual(told.call_count, 1)
            services.tick(m.ends_at - timedelta(hours=20))
            self.assertEqual(told.call_count, 2)
            services.tick(m.ends_at + timedelta(minutes=1))
            self.assertEqual(told.call_count, 3)  # «ended» (and wrapped up: no board, no more notices)
            services.tick(m.ends_at + timedelta(minutes=20))
            self.assertEqual(told.call_count, 3)

    def points(self, user):
        return TokenWalletAccount.objects.get(wallet__owner=user).amount
