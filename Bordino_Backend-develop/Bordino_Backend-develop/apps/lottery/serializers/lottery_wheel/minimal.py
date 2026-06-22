from apps.django_helper.drf.serializers import BaseModelSerializer
from apps.lottery.models import LotteryWheel


class LotteryWheelMinimalSerializer(BaseModelSerializer):
    class Meta:
        model = LotteryWheel
        fields = ("name",)
