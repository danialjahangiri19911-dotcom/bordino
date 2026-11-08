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
        self.assertEqual((analytics["started"], analytics["completed"], analytics["stages"][3]["verified_visit"]), (1, 1, True))

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
