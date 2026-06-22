from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from apps.configuration.repositories.game import GameConfigurationQueryRepository
from apps.configuration.schemas.game.crud import get_configuration_schema
from apps.configuration.serializers.game import GameConfigurationSerializer


class GameConfigurationCRUDView(GenericViewSet):
    serializer_class = GameConfigurationSerializer
    permission_classes = (IsAuthenticated,)

    def get_queryset(self):
        return GameConfigurationQueryRepository.filter_active()

    @get_configuration_schema
    @action(detail=False, methods=["get"], url_path="")
    def get_configuration(self, request):
        game_name = request.query_params.get("game_name")
        difficulty_level = request.query_params.get("difficulty_level")

        if not game_name:
            raise ValidationError({"game_name": "Game name parameter is required"})

        config = GameConfigurationQueryRepository.get_by_game_name(
            game_name=game_name, difficulty_level=difficulty_level
        )

        if not config:
            error_msg = f"Active game configuration not found for game '{game_name}'" + (
                f" with difficulty '{difficulty_level}'" if difficulty_level else ""
            )
            raise NotFound(error_msg)

        serializer = self.get_serializer(config)
        return Response(serializer.data)
