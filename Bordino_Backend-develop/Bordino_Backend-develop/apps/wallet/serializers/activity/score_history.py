from rest_framework import serializers

from apps.django_helper.drf.serializers import BaseModelSerializer
from apps.wallet.models.transactions.activity import ActivityTransaction


class ActivityTransactionSerializer(BaseModelSerializer):
    section_display = serializers.CharField(source="get_section_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = ActivityTransaction
        fields = (
            "section",
            "section_display",
            "action_type",
            "score_value",
            "status",
            "status_display",
            "reward_data",
            "metadata",
            "description",
        )
