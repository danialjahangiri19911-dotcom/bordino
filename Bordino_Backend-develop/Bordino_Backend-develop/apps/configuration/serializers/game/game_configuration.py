from rest_framework import serializers

from apps.configuration.models.game import GameConfiguration
from apps.configuration.repositories.scoring import ScoreConfigurationQueryRepository
from apps.configuration.serializers.game.action_score import ActionScoreSerializer
from apps.django_helper.drf.serializers import BaseModelSerializer


class GameConfigurationSerializer(BaseModelSerializer):
    difficulty_level_display = serializers.CharField(
        source="get_difficulty_level_display",
        read_only=True,
        allow_null=True,
    )
    action_scores = serializers.SerializerMethodField()

    class Meta:
        model = GameConfiguration
        fields = (
            "game_name",
            "difficulty_level",
            "difficulty_level_display",
            "timer",
            "max_errors",
            "hint_count",
            "daily_score_limit",
            "is_active",
            "action_scores",
        )

    def get_action_scores(self, obj):
        game_name = obj.game_name.lower() if obj.game_name else obj.game_name
        configs = ScoreConfigurationQueryRepository.get_configs_by_section(game_name)
        return ActionScoreSerializer(configs, many=True).data
