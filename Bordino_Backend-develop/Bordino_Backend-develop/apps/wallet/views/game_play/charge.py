from django.core.exceptions import ValidationError
from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from drf_spectacular.utils import OpenApiParameter, extend_schema

from apps.wallet.services import balance
from apps.wallet.services.game_play.charge import GamePlayChargeService


class GamePlayChargeSerializer(serializers.Serializer):
    game_name = serializers.CharField()
    # Made by the app for each play it starts and kept for its retries (see GamePlayCharge).
    # One id per play the app starts (it always sends one): a retry after a lost answer is the
    # same play, charged once.
    request_id = serializers.CharField(max_length=64, allow_blank=False)
    # The level being paid for (sudoku's continuation): charged at that level's price.
    difficulty = serializers.CharField(max_length=20, required=False, allow_blank=True)


class GamePlayChargeResponseSerializer(serializers.Serializer):
    game_name = serializers.CharField()
    cost = serializers.IntegerField()
    new_amount = serializers.IntegerField()


class GamePlayCostSerializer(serializers.Serializer):
    game_name = serializers.CharField()
    play_cost = serializers.IntegerField(allow_null=True)
    current_amount = serializers.IntegerField()


class GamePlayChargeView(APIView):
    """خواندن/کسرِ هزینهٔ بازی از کیفِ امتیاز (هر بار بازی)."""

    permission_classes = (IsAuthenticated,)

    @extend_schema(
        tags=["wallet"],
        summary="Get a game's play cost and current points",
        parameters=[
            OpenApiParameter("game_name", str, required=True),
            OpenApiParameter("difficulty_level", str, required=False),
        ],
        responses={200: GamePlayCostSerializer},
    )
    def get(self, request):
        game_name = (request.query_params.get("game_name") or "").lower().strip()

        # The price that is charged: the level's own when one is named (sudoku), never another's.
        try:
            play_cost = GamePlayChargeService.price(game_name, request.query_params.get("difficulty_level") or None)
        except ValidationError:
            play_cost = None  # that level is not on offer

        # The account a play is charged to (points, token L) — not "the first account".
        account = balance.points_account(request.user)
        current_amount = int(account.amount) if account else 0

        body = {"game_name": game_name, "play_cost": play_cost, "current_amount": current_amount}
        # The bet games have no entry fee: their bet is the entry, at least the smallest bet per round.
        if game_name in ("crash", "chicken"):
            from apps.crash.models import ChickenConfiguration, CrashConfiguration  # pylint: disable=import-outside-toplevel

            config = (CrashConfiguration if game_name == "crash" else ChickenConfiguration).current()
            body["min_bet"] = int(config.min_bet) if config.enabled else None
        return Response(body, status=status.HTTP_200_OK)

    @extend_schema(
        tags=["wallet"],
        summary="Charge points for playing a game",
        request=GamePlayChargeSerializer,
        responses={200: GamePlayChargeResponseSerializer},
    )
    def post(self, request):
        serializer = GamePlayChargeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            result = GamePlayChargeService().charge(
                user=request.user,
                game_name=serializer.validated_data["game_name"],
                request_id=serializer.validated_data.get("request_id"),
                difficulty=serializer.validated_data.get("difficulty") or None,
            )
        except ValidationError as exc:
            message = exc.messages[0] if getattr(exc, "messages", None) else str(exc)
            return Response({"error": message}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            {
                "game_name": result.game_name,
                "cost": result.cost,
                "new_amount": result.new_amount,
            },
            status=status.HTTP_200_OK,
        )
