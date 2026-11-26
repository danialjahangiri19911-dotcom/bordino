from django.test import TestCase
from rest_framework.test import APIClient

from apps.configuration.models import GameConfiguration, ScoreConfiguration
from apps.wallet.tests import make_customer


class GamePricesTests(TestCase):
    """The game cards' numbers: the same fees, smallest bets and level rewards the server uses."""

    def test_fees_bets_and_rewards_as_configured(self):
        GameConfiguration.objects.all().delete()
        GameConfiguration.objects.create(game_name="sudoku", difficulty_level="easy", play_cost=1500, is_active=True)
        GameConfiguration.objects.create(game_name="sudoku", difficulty_level="hard", play_cost=3000, is_active=True)
        GameConfiguration.objects.create(game_name="sudoku", difficulty_level="medium", play_cost=9999, is_active=False)
        GameConfiguration.objects.create(game_name="game_2048", difficulty_level=None, play_cost=2000, is_active=True)
        ScoreConfiguration.objects.filter(section="sudoku").delete()
        ScoreConfiguration.objects.create(section="sudoku", action_type="easy_level_completed", score_value=500, is_active=True)
        ScoreConfiguration.objects.create(section="sudoku", action_type="hard_level_completed", score_value=1200, is_active=True)
        ScoreConfiguration.objects.create(section="sudoku", action_type="row_completed", score_value=100, is_active=True)
        api = APIClient()
        api.force_authenticate(make_customer("9120007001"))
        r = api.get("/api/v1/wallet/games/prices/")
        self.assertEqual(r.status_code, 200, r.content)
        games = r.json()["result"]["games"]
        self.assertEqual(games["sudoku"], {"fee_min": 1500, "fee_max": 3000, "reward_min": 500, "reward_max": 1200})
        self.assertEqual(games["game_2048"], {"fee_min": 2000, "fee_max": 2000})
        self.assertEqual(games["spy"], {"fee_min": 0, "fee_max": 0})  # no price set: free
        self.assertIn("min_bet", games["crash"])
        self.assertEqual(APIClient().get("/api/v1/wallet/games/prices/").status_code, 401)
