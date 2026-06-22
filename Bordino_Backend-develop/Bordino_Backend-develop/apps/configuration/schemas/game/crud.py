from drf_spectacular.utils import OpenApiParameter, extend_schema

from apps.configuration.serializers.game import GameConfigurationSerializer

get_configuration_schema = extend_schema(
    tags=["configuration"],
    summary="Get Game Configuration",
    description="Get game configuration by game name. Returns the active configuration for the specified game.",
    parameters=[
        OpenApiParameter(
            name="game_name",
            type=str,
            location=OpenApiParameter.QUERY,
            required=True,
            description="Name of the game (e.g., 'sudoku', 'game_2048')",
        ),
        OpenApiParameter(
            name="difficulty_level",
            type=str,
            location=OpenApiParameter.QUERY,
            required=False,
            description="Difficulty level (easy, medium, hard). If not provided, returns medium difficulty.",
        ),
    ],
    responses={
        200: GameConfigurationSerializer,
        404: {
            "type": "object",
            "properties": {
                "error": {"type": "string"},
            },
        },
    },
)
