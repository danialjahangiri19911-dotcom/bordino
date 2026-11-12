from rest_framework import serializers

from apps.django_helper.drf.serializers import BaseModelSerializer
from apps.lottery.models import LotteryWheelPrize


class LotteryWheelPrizeMinimalSerializer(BaseModelSerializer):
    # While the cash wallet is hidden a toman prize is paid as the same number of coins: shown so.
    prize_type = serializers.SerializerMethodField()

    class Meta:
        model = LotteryWheelPrize
        fields = (
            "id",
            "name",
            "prize_amount",
            "prize_type",
            "probability",
        )

    def get_prize_type(self, obj):
        from apps.coins.services import cash_prizes_as_coins  # pylint: disable=import-outside-toplevel

        if obj.prize_type == LotteryWheelPrize.PrizeType.CASH and cash_prizes_as_coins():
            return LotteryWheelPrize.PrizeType.RECHARGE
        return obj.prize_type
