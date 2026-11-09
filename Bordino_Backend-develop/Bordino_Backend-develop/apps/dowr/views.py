from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from drf_spectacular.utils import extend_schema

from apps.dowr import services
from apps.dowr.models import BOMB_PENALTIES, BOMB_SECONDS, ROUNDS, SECONDS, TEAMS_RANGE, DowrGame

NAME = 24  # team and player names (the app cuts them at the same length)
# Bounds of a real game: ≤ 10 rounds × 12 players, each answer ≤ 1000; swaps (−100) and the bomb
# (≤ −2000 each) can push a team below zero.
MAX_POINTS = 1_000_000


class SaveThrottle(UserRateThrottle):
    scope = "dowr_save"
    rate = "20/min"


class TeamSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=NAME)
    members = serializers.ListField(child=serializers.CharField(max_length=NAME, allow_blank=True), min_length=2, max_length=2)
    score = serializers.IntegerField(min_value=-MAX_POINTS, max_value=MAX_POINTS)
    rank = serializers.IntegerField(min_value=1, max_value=TEAMS_RANGE[1])
    correct = serializers.IntegerField(min_value=0, max_value=10_000)


class LogSerializer(serializers.Serializer):
    round = serializers.IntegerField(min_value=1, max_value=max(ROUNDS))
    team = serializers.IntegerField(min_value=0, max_value=TEAMS_RANGE[1] - 1)
    player = serializers.CharField(max_length=NAME, allow_blank=True)
    text = serializers.CharField(max_length=60, allow_blank=True)
    kind = serializers.ChoiceField(choices=("correct", "foul", "timeout", "skip", "bomb"))
    points = serializers.IntegerField(min_value=-5000, max_value=1000)
    elapsed_ms = serializers.IntegerField(min_value=0, max_value=10**7, default=0)


class BombSerializer(serializers.Serializer):
    enabled = serializers.BooleanField()
    seconds = serializers.IntegerField(min_value=BOMB_SECONDS[0], max_value=BOMB_SECONDS[1], required=False)
    penalty = serializers.ChoiceField(choices=BOMB_PENALTIES, required=False)
    explosions = serializers.IntegerField(min_value=0, max_value=1000, default=0)


class GameSerializer(serializers.Serializer):
    request_id = serializers.CharField(max_length=64)
    mode = serializers.ChoiceField(choices=DowrGame.Mode.values)
    rounds = serializers.ChoiceField(choices=ROUNDS)
    seconds = serializers.ChoiceField(choices=SECONDS)
    teams = serializers.ListField(child=TeamSerializer(), min_length=TEAMS_RANGE[0], max_length=TEAMS_RANGE[1])
    bomb = BombSerializer(required=False)
    log = serializers.ListField(child=LogSerializer(), max_length=services.LOG_KEEP, required=False)

    def validate(self, attrs):
        teams = attrs["teams"]
        if any(entry["team"] >= len(teams) or entry["round"] > attrs["rounds"] for entry in attrs.get("log", [])):
            raise serializers.ValidationError("پاسخی برای تیم یا دوری که در بازی نیست.")
        return attrs


class DowrConfigView(APIView):
    """The game's switch, limits, topics and cards (edited in the admin)."""

    permission_classes = (IsAuthenticated,)

    @extend_schema(tags=["dowr"], summary="Dowr settings and cards")
    def get(self, request):
        return Response(services.config_payload())


class DowrGamesView(APIView):
    """The player's finished games: recorded when one ends, listed as «بازی‌های اخیر»."""

    permission_classes = (IsAuthenticated,)

    def get_throttles(self):
        return [SaveThrottle()] if self.request.method == "POST" else super().get_throttles()

    @extend_schema(tags=["dowr"], summary="My recent Dowr games")
    def get(self, request):
        customer = getattr(request.user, "customer", None)
        if customer is None:
            return Response({"error": "حساب بازیکن پیدا نشد."}, status=status.HTTP_400_BAD_REQUEST)
        return Response(services.history(customer))

    @extend_schema(tags=["dowr"], summary="Record a finished Dowr game", request=GameSerializer)
    def post(self, request):
        customer = getattr(request.user, "customer", None)
        if customer is None:
            return Response({"error": "حساب بازیکن پیدا نشد."}, status=status.HTTP_400_BAD_REQUEST)
        data = GameSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        game, created = services.save_game(customer, data.validated_data)
        return Response({"game": services.summary(game), "already_saved": not created}, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)
