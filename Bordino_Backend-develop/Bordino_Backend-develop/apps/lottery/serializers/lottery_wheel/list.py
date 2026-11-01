from apps.django_helper.drf.serializers import BaseModelSerializer
from apps.lottery.models import LotteryWheel
from apps.lottery.serializers.lottery_wheel_prize.minimal import LotteryWheelPrizeMinimalSerializer


class LotteryWheelSerializer(BaseModelSerializer):
    lottery_wheel_prizes = LotteryWheelPrizeMinimalSerializer(many=True)

    class Meta:
        model = LotteryWheel
        fields = (
            "name",
            "owner",
            "cost_per_spin",
            "min_bet",
            "max_bet",
            "max_spins_per_customer",
            "lottery_wheel_prizes",
        )
