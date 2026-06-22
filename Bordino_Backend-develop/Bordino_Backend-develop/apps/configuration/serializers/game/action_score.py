from apps.configuration.models.scoring import ScoreConfiguration
from apps.django_helper.drf.serializers import BaseModelSerializer


class ActionScoreSerializer(BaseModelSerializer):
    class Meta:
        model = ScoreConfiguration
        fields = (
            "action_type",
            "score_value",
            "is_active",
            "metadata",
        )
