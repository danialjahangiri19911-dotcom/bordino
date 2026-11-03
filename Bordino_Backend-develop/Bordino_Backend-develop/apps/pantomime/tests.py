from django.contrib.admin.sites import site
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.pantomime.models import PantomimeCard, PantomimeCategory, PantomimeGame, PantomimeSettings
from apps.wallet.services import balance
from apps.wallet.tests import LOCMEM, make_customer

CONFIG = "/api/v1/games/pantomime/config/"
GAMES = "/api/v1/games/pantomime/games/"


def result(response):
    return response.json()["result"]


def game(request_id="g-1", **over):
    body = {
        "request_id": request_id,
        "format": "challenge",
        "mode": "classic",
        "rounds": 1,
        "teams": [
            {"name": "تیم A", "members": ["سارا", "علی"], "score": 1, "rank": 1, "correct": 1, "correct_elapsed_ms": 5350},
            {"name": "تیم B", "members": ["بازیکن ۱", "بازیکن ۲"], "score": 0, "rank": 2, "correct": 0},
        ],
        "turns": [
            {"team": 0, "round": 1, "player": "سارا", "points": 1, "cards": [{"text": "راه رفتن روی ماه", "result": "correct", "elapsed_ms": 5350}]},
            {"team": 1, "round": 1, "player": "بازیکن ۱", "points": 0, "cards": [{"text": "شازده کوچولو", "result": "timeout", "elapsed_ms": 90000}]},
        ],
    }
    body.update(over)
    return body


@override_settings(CACHES=LOCMEM)
class PantomimeTests(TestCase):
    def setUp(self):
        cache.clear()
        self.user = make_customer("9120008001", points=100)
        self.api = APIClient()
        self.api.force_authenticate(self.user)

    def test_the_designs_clues_are_in_the_bank(self):
        self.assertEqual(PantomimeCategory.objects.count(), 6)
        self.assertEqual(PantomimeCard.objects.filter(is_active=True).count(), 180)
        self.assertEqual(PantomimeSettings.objects.count(), 1)
        body = result(self.api.get(CONFIG))
        self.assertTrue(body["enabled"])
        self.assertEqual([c["id"] for c in body["categories"]], ["daily", "animals", "jobs", "sports", "screen", "phrases"])
        self.assertEqual({c["id"]: c["weight"] for c in body["categories"]}["phrases"], 1.6)
        self.assertEqual(len(body["cards"]), 180)
        self.assertEqual(body["limits"]["turn_seconds"], [30, 900])
        self.assertEqual(APIClient().get(CONFIG).status_code, 401)

    def test_what_the_admin_switches_off_is_not_offered(self):
        PantomimeCard.objects.filter(text="گربه").update(is_active=False)
        PantomimeCard.objects.filter(category__slug="jobs").update(is_active=False)  # a topic with no clues left
        PantomimeCategory.objects.filter(slug="screen").update(is_active=False)
        settings = PantomimeSettings.current()
        settings.enabled, settings.max_rounds, settings.max_teams = False, 3, 4
        settings.save()
        body = result(self.api.get(CONFIG))
        self.assertFalse(body["enabled"])
        self.assertEqual((body["limits"]["max_rounds"], body["limits"]["max_teams"]), (3, 4))
        self.assertEqual([c["id"] for c in body["categories"]], ["daily", "animals", "sports", "phrases"])
        self.assertEqual({c["id"]: c["count"] for c in body["categories"]}["animals"], 29)
        texts = {c["text"] for c in body["cards"]}
        self.assertNotIn("گربه", texts)
        self.assertNotIn("آشپز", texts)
        self.assertEqual(len(body["cards"]), 180 - 30 - 30 - 1)

    def test_settings_keep_their_ranges(self):
        settings = PantomimeSettings.current()
        settings.min_turn_seconds, settings.max_turn_seconds = 300, 60
        with self.assertRaises(ValidationError):
            settings.full_clean()
        settings.min_turn_seconds, settings.max_turn_seconds, settings.max_teams = 30, 900, 7
        with self.assertRaises(ValidationError):
            settings.full_clean()

    def test_a_finished_game_is_recorded_once_and_listed(self):
        first = self.api.post(GAMES, game(), format="json")
        self.assertEqual(first.status_code, 201, first.content)
        self.assertEqual(result(first)["game"]["winners"], "تیم A")
        again = self.api.post(GAMES, game(), format="json")  # a resend after a lost answer
        self.assertEqual((again.status_code, result(again)["already_saved"]), (200, True))
        self.assertEqual(PantomimeGame.objects.count(), 1)
        tie = game("g-2", format="duel", teams=[
            {"name": "قرمز", "members": ["a", "b"], "score": 300, "rank": 1, "correct": 1},
            {"name": "آبی", "members": ["c", "d"], "score": 300, "rank": 1, "correct": 1},
        ], turns=[])
        self.assertEqual(result(self.api.post(GAMES, tie, format="json"))["game"]["winners"], "قرمز، آبی")
        listing = result(self.api.get(GAMES))
        self.assertEqual((listing["total"], listing["by_format"]), (2, {"challenge": 1, "duel": 1, "marathon": 0}))
        self.assertEqual([g["format"] for g in listing["results"]], ["duel", "challenge"])
        # Another player sees none of them, and nothing moved any points.
        other = APIClient()
        other.force_authenticate(make_customer("9120008002"))
        self.assertEqual(result(other.get(GAMES))["total"], 0)
        self.assertEqual(balance.points_account(self.user).amount, 100)

    def test_a_report_out_of_shape_is_refused(self):
        bad = [
            game(teams=game()["teams"][:1]),  # one team
            game(format="poker"),
            game(rounds=11),
            game(rounds=1, turns=game()["turns"] * 2),  # more turns than rounds × teams
            game(turns=[{**game()["turns"][0], "team": 5}]),  # a team that is not in the game
            game(turns=[{**game()["turns"][0], "round": 2}]),
            game(teams=[{**game()["teams"][0], "name": "x" * 25}, game()["teams"][1]]),
            game(teams=[{**game()["teams"][0], "members": ["تنها"]}, game()["teams"][1]]),
            game(turns=[{**game()["turns"][0], "cards": [{"text": "a", "result": "won"}]}]),
            game(rounds=10, turns=[{**game()["turns"][0], "cards": [{"text": "a", "result": "pass"}] * 201}]),
            game(request_id=""),
        ]
        for i, body in enumerate(bad):
            self.assertEqual(self.api.post(GAMES, body, format="json").status_code, 400, i)
        self.assertEqual(PantomimeGame.objects.count(), 0)
        self.assertEqual(APIClient().post(GAMES, game(), format="json").status_code, 401)

    def test_the_admin(self):
        self.assertFalse(site._registry[PantomimeSettings].has_add_permission(type("R", (), {"user": self.user})()))  # pylint: disable=protected-access
        self.assertFalse(site._registry[PantomimeSettings].has_delete_permission(None))  # pylint: disable=protected-access
        self.assertFalse(site._registry[PantomimeGame].has_change_permission(None))  # pylint: disable=protected-access
        from django.contrib.auth import get_user_model  # pylint: disable=import-outside-toplevel

        boss = get_user_model().objects.create_superuser(phone_number="9120008003", password="x-Pass-123")
        self.client.force_login(boss)
        for url in ("/admin/pantomime/pantomimecard/", "/admin/pantomime/pantomimecategory/", "/admin/pantomime/pantomimegame/",
                    f"/admin/pantomime/pantomimecategory/{PantomimeCategory.objects.first().pk}/change/"):
            self.assertEqual(self.client.get(url).status_code, 200, url)
