"""Every game's price and coin reward in one answer, for the game cards (2026-11-26, product review:
show what a game costs and whether it pays coins before it is opened). The same numbers the server
charges and pays: entry fees (GameConfiguration.play_cost, per level for sudoku), the bet games'
smallest bet, and the coins a solved level pays (ScoreConfiguration «<level>_level_completed»)."""

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.configuration.models import GameConfiguration, ScoreConfiguration

FEE_GAMES = ("sudoku", "game_2048", "pantomime", "dowr", "spy")
BET_GAMES = ("crash", "chicken")


def prices() -> dict:
    out: dict[str, dict] = {}
    rows = GameConfiguration.objects.filter(game_name__in=FEE_GAMES, is_active=True).values_list("game_name", "play_cost")
    for game in FEE_GAMES:
        fees = [int(cost) for name, cost in rows if name == game]
        out[game] = {"fee_min": min(fees) if fees else 0, "fee_max": max(fees) if fees else 0}
    from apps.crash.models import ChickenConfiguration, CrashConfiguration  # pylint: disable=import-outside-toplevel

    for game, model in (("crash", CrashConfiguration), ("chicken", ChickenConfiguration)):
        config = model.current()
        out[game] = {"min_bet": int(config.min_bet) if config.enabled else None, "max_bet": int(config.max_bet) if config.enabled else None}
    # What a solved level pays (sudoku): the smallest and largest of the active ones.
    paid = [
        int(v)
        for v in ScoreConfiguration.objects.filter(section="sudoku", is_active=True, action_type__endswith="_level_completed", score_value__gt=0).values_list(
            "score_value", flat=True
        )
    ]
    out["sudoku"].update({"reward_min": min(paid) if paid else 0, "reward_max": max(paid) if paid else 0})
    return out


class GamePricesView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        return Response({"games": prices()})
