from django.core.exceptions import ValidationError
from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from drf_spectacular.utils import OpenApiParameter, extend_schema

from apps.configuration.repositories.game import GameConfigurationQueryRepository
from apps.wallet.services import balance
from apps.wallet.services.game_play.charge import GamePlayChargeService


class GamePlayChargeSerializer(serializers.Serializer):
    game_name = serializers.CharField()


class GamePlayChargeResponseSerializer(serializers.Serializer):
    game_name = serializers.CharField()
    cost = serializers.IntegerField()
    new_amount = serializers.IntegerField()


class GamePlayCostSerializer(serializers.Serializer):
    game_name = serializers.CharField()
    play_cost = serializers.IntegerField()
    current_amount = serializers.IntegerField()


class GamePlayChargeView(APIView):
    """خواندن/کسرِ هزینهٔ بازی از کیفِ امتیاز (هر بار بازی)."""

    permission_classes = (IsAuthenticated,)

    @extend_schema(
        tags=["wallet"],
        summary="Get a game's play cost and current points",
        parameters=[OpenApiParameter("game_name", str, required=True)],
        responses={200: GamePlayCostSerializer},
    )
    def get(self, request):
        game_name = (request.query_params.get("game_name") or "").lower().strip()

        game_config = GameConfigurationQueryRepository.filter_by_game_name(
            game_name=game_name
        ).first()
        play_cost = int(game_config.play_cost) if game_config else 0

        # The account a play is charged to (points, token L) — not "the first account".
        account = balance.points_account(request.user)
        current_amount = int(account.amount) if account else 0

        return Response(
            {
                "game_name": game_name,
                "play_cost": play_cost,
                "current_amount": current_amount,
            },
            status=status.HTTP_200_OK,
        )

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
