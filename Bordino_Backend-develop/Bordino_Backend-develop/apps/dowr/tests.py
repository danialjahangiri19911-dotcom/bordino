import uuid

from django.core.exceptions import ValidationError
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.dowr.models import DowrCard, DowrCategory, DowrGame, DowrSettings
from apps.missions.tests import LOCMEM, make_player

URL = "/api/v1/games/dowr/"


def body(r):
    data = r.json()
    return data["result"] if data.get("is_successful") else data.get("errors", data)


def result(**extra) -> dict:
    """A finished game as the app reports it (two teams, one round)."""
    return {
        "request_id": str(uuid.uuid4()),
        "mode": "taboo",
        "rounds": 1,
        "seconds": 30,
        "teams": [
            {"name": "تیم A", "members": ["علی", "سارا"], "score": 1350, "rank": 1, "correct": 2},
            {"name": "تیم B", "members": ["رضا", ""], "score": -400, "rank": 2, "correct": 0},
        ],
        "bomb": {"enabled": True, "seconds": 60, "penalty": 500, "explosions": 1},
        "log": [
            {"round": 1, "team": 0, "player": "علی", "text": "مسواک", "kind": "correct", "points": 850, "elapsed_ms": 5000},
            {"round": 1, "team": 1, "player": "رضا", "text": "چتر", "kind": "skip", "points": -100, "elapsed_ms": 2000},
            {"round": 1, "team": 1, "player": "رضا", "text": "", "kind": "bomb", "points": -500, "elapsed_ms": 0},
        ],
        **extra,
    }


@override_settings(CACHES=LOCMEM)
class DowrTests(TestCase):
    def setUp(self):
        self.player = make_player("9120007001")
        self.api = APIClient()
        self.api.force_authenticate(self.player)

    def test_the_design_cards_are_there_and_served(self):
        self.assertEqual((DowrCategory.objects.count(), DowrCard.objects.count()), (6, 120))
        cfg = body(self.api.get(URL + "config/"))
        self.assertTrue(cfg["enabled"])
        self.assertEqual(len(cfg["categories"]), 6)
        self.assertEqual(len(cfg["cards"]), 120)
        card = next(c for c in cfg["cards"] if c["text"] == "مسواک")
        self.assertEqual((card["category"], card["difficulty"], card["forbidden"]), ("daily", 1, ["دندان", "خمیر", "دهان"]))
        # Bordino switches a card or a topic off in the admin: it is no longer served.
        DowrCard.objects.filter(text="مسواک").update(is_active=False)
        DowrCategory.objects.filter(slug="food").update(is_active=False)
        cfg = body(self.api.get(URL + "config/"))
        self.assertNotIn("مسواک", [c["text"] for c in cfg["cards"]])
        self.assertNotIn("food", [c["id"] for c in cfg["categories"]])
        self.assertNotIn("food", {c["category"] for c in cfg["cards"]})

    def test_the_switch_and_limits_come_from_the_admin(self):
        s = DowrSettings.objects.get()
        s.enabled, s.bomb_allowed, s.max_rounds = False, False, 5
        s.save()
        cfg = body(self.api.get(URL + "config/"))
        self.assertEqual((cfg["enabled"], cfg["limits"]["bomb_allowed"], cfg["limits"]["max_rounds"]), (False, False, 5))
        s.max_rounds = 4
        with self.assertRaises(ValidationError):
            s.save()

    def test_a_card_needs_exactly_three_forbidden_words(self):
        cat = DowrCategory.objects.get(slug="daily")
        for bad in ("یک،دو", "یک،دو،سه،چهار", "کلید،دو،سه"):
            with self.assertRaises(ValidationError):
                DowrCard.objects.create(category=cat, text="کلید", forbidden=bad)
        ok = DowrCard.objects.create(category=cat, text="قوری", forbidden="چای، دم ,آب")
        self.assertEqual(ok.forbidden_list(), ["چای", "دم", "آب"])

    def test_a_finished_game_is_recorded_once(self):
        data = result()
        r = self.api.post(URL + "games/", data, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(body(r)["game"]["winners"], "تیم A")
        again = self.api.post(URL + "games/", data, format="json")
        self.assertEqual((again.status_code, body(again)["already_saved"]), (200, True))
        self.assertEqual(DowrGame.objects.count(), 1)
        g = DowrGame.objects.get()
        self.assertEqual((g.mode, g.team_count, g.bomb["explosions"], len(g.log)), ("taboo", 2, 1, 3))
        hist = body(self.api.get(URL + "games/"))
        self.assertEqual((hist["total"], hist["games"][0]["teams"][1]["score"]), (1, -400))

    def test_a_tie_names_every_winner(self):
        data = result()
        data["teams"][1].update(score=1350, rank=1)
        self.assertEqual(body(self.api.post(URL + "games/", data, format="json"))["game"]["winners"], "تیم A، تیم B")

    def test_impossible_reports_are_refused(self):
        for broken in (
            result(mode="relay"),
            result(rounds=4),
            result(seconds=25),
            result(teams=[{"name": "تنها", "members": ["a", "b"], "score": 0, "rank": 1, "correct": 0}]),
            result(log=[{"round": 3, "team": 0, "player": "x", "text": "y", "kind": "correct", "points": 500}]),
            result(log=[{"round": 1, "team": 5, "player": "x", "text": "y", "kind": "correct", "points": 500}]),
            result(log=[{"round": 1, "team": 0, "player": "x", "text": "y", "kind": "correct", "points": 5000}]),
        ):
            self.assertEqual(self.api.post(URL + "games/", broken, format="json").status_code, 400, broken)
        self.assertEqual(DowrGame.objects.count(), 0)

    def test_players_see_only_their_own_games(self):
        self.api.post(URL + "games/", result(), format="json")
        other = APIClient()
        other.force_authenticate(make_player("9120007002"))
        self.assertEqual(body(other.get(URL + "games/"))["total"], 0)
        self.assertIn(APIClient().get(URL + "config/").status_code, (401, 403))
