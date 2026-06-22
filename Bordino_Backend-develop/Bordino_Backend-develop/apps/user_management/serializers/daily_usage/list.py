from apps.django_helper.drf.serializers import BaseModelSerializer
from apps.users.models.dailyusage import DailyUsage


class DailyUsageSerializer(BaseModelSerializer):
    class Meta:
        model = DailyUsage
        fields = ("usage_duration_per_day", "reward_points")
