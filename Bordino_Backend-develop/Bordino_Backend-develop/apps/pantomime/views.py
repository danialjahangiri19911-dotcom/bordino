from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from drf_spectacular.utils import extend_schema

from apps.pantomime import services
from apps.pantomime.models import MEMBERS_RANGE, ROUNDS_RANGE, TEAMS_RANGE, PantomimeGame

NAME = 24  # team and player names (the app cuts them at the same length)
# The record keeps up to this many cards' details (a «رکورد در زمان» turn can show hundreds; the app
# sends the first ones and the true count in cards_total).
MAX_TURN_CARDS = 200
MAX_CARDS = 1500
# The most a team can really answer in one game: 10 turns × 900 s ÷ 0.3 s between answers.
MAX_TEAM_ANSWERS = 30_000
MAX_GAME_POINTS = 1_000_000


class SaveThrottle(UserRateThrottle):
    scope = "pantomime_save"
    rate = "20/min"


class TeamSerializer(serializers.Serializer):
    # In the game's own order: a turn's `team` is an index into this list.
    name = serializers.CharField(max_length=NAME)
    members = serializers.ListField(
        child=serializers.CharField(max_length=NAME), min_length=MEMBERS_RANGE[0], max_length=MEMBERS_RANGE[1]
    )
    # Totals of the whole game, not of the details kept: the largest game the app allows (10 turns of
    # 900 s for a team, an answer every 0.3 s) stays within them.
    score = serializers.IntegerField(min_value=0, max_value=MAX_GAME_POINTS)
    rank = serializers.IntegerField(min_value=1, max_value=TEAMS_RANGE[1])
    correct = serializers.IntegerField(min_value=0, max_value=MAX_TEAM_ANSWERS)
    correct_elapsed_ms = serializers.IntegerField(min_value=0, max_value=MAX_TEAM_ANSWERS * 900_000, default=0)


class CardSerializer(serializers.Serializer):
    text = serializers.CharField(max_length=120)
    result = serializers.ChoiceField(choices=("correct", "pass", "timeout"))
    elapsed_ms = serializers.IntegerField(min_value=0, max_value=10**6, default=0)


class TurnSerializer(serializers.Serializer):
    team = serializers.IntegerField(min_value=0, max_value=TEAMS_RANGE[1] - 1)
    round = serializers.IntegerField(min_value=ROUNDS_RANGE[0], max_value=ROUNDS_RANGE[1])
    player = serializers.CharField(max_length=NAME)
    points = serializers.IntegerField(min_value=0, max_value=MAX_GAME_POINTS)
    cards = serializers.ListField(child=CardSerializer(), max_length=MAX_TURN_CARDS)
    cards_total = serializers.IntegerField(min_value=0, max_value=100_000, required=False)

    def validate(self, attrs):
        attrs["cards_total"] = max(attrs.get("cards_total") or 0, len(attrs["cards"]))
        return attrs


class GameSerializer(serializers.Serializer):
    request_id = serializers.CharField(max_length=64)
    format = serializers.ChoiceField(choices=PantomimeGame.Format.values)
    mode = serializers.ChoiceField(choices=PantomimeGame.Mode.values)
    rounds = serializers.IntegerField(min_value=ROUNDS_RANGE[0], max_value=ROUNDS_RANGE[1])
    teams = serializers.ListField(child=TeamSerializer(), min_length=TEAMS_RANGE[0], max_length=TEAMS_RANGE[1])
    turns = serializers.ListField(child=TurnSerializer(), max_length=ROUNDS_RANGE[1] * TEAMS_RANGE[1])

    def validate(self, attrs):
        teams, turns = attrs["teams"], attrs["turns"]
        if len(turns) > attrs["rounds"] * len(teams):
            raise serializers.ValidationError("تعداد نوبت‌ها بیش از دورها × تیم‌هاست.")
        if any(t["team"] >= len(teams) or t["round"] > attrs["rounds"] for t in turns):
            raise serializers.ValidationError("نوبتی برای تیم یا دوری که در بازی نیست.")
        if sum(len(t["cards"]) for t in turns) > MAX_CARDS:
            raise serializers.ValidationError("کارت‌های این بازی بیش از حد است.")
        return attrs


class PantomimeConfigView(APIView):
    """The game's switch, limits, topics and clues (edited in the admin)."""

    permission_classes = (IsAuthenticated,)

    @extend_schema(tags=["pantomime"], summary="Pantomime settings and clues")
    def get(self, request):
        return Response(services.config_payload())


class PantomimeGamesView(APIView):
    """The player's finished games: recorded when one ends, listed as «بازی‌های اخیر»."""

    permission_classes = (IsAuthenticated,)

    def get_throttles(self):
        return [SaveThrottle()] if self.request.method == "POST" else super().get_throttles()

    @extend_schema(tags=["pantomime"], summary="My recent pantomime games")
    def get(self, request):
        customer = getattr(request.user, "customer", None)
        if customer is None:
            return Response({"error": "حساب بازیکن پیدا نشد."}, status=status.HTTP_400_BAD_REQUEST)
        return Response(services.history(customer))

    @extend_schema(tags=["pantomime"], summary="Record a finished pantomime game", request=GameSerializer)
    def post(self, request):
        customer = getattr(request.user, "customer", None)
        if customer is None:
            return Response({"error": "حساب بازیکن پیدا نشد."}, status=status.HTTP_400_BAD_REQUEST)
        data = GameSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        game, created = services.save_game(customer, data.validated_data)
        return Response(
            {"game": services.summary(game), "already_saved": not created},
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )
