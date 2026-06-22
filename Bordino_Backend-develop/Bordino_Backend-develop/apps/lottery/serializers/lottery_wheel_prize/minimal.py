from rest_framework import serializers

from apps.django_helper.drf.serializers import BaseModelSerializer
from apps.lottery.models import LotteryWheelPrize


class LotteryWheelPrizeMinimalSerializer(BaseModelSerializer):
    probability = serializers.CharField()

    class Meta:
        model = LotteryWheelPrize
        fields = (
            "name",
            "probability",
        )
