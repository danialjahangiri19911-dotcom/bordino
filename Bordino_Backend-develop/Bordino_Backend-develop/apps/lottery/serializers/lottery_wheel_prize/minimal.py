from apps.django_helper.drf.serializers import BaseModelSerializer
from apps.lottery.models import LotteryWheelPrize


class LotteryWheelPrizeMinimalSerializer(BaseModelSerializer):
    class Meta:
        model = LotteryWheelPrize
        fields = (
            "id",
            "name",
            "prize_amount",
            "prize_type",
            "probability",
        )
