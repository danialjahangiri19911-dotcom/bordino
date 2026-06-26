from rest_framework import serializers

from apps.django_helper.drf.serializers import BaseModelSerializer
from apps.lottery.models import Lottery


class LotterySerializer(BaseModelSerializer):
    balance_in_money = serializers.SerializerMethodField()

    def get_balance_in_money(self, obj):
        return str(obj.prize_amount_in_money)

    class Meta:
        model = Lottery
        fields = (
            "name",
            "owner",
            "token",
            "balance_in_money",
            "ticket_price",
            "status",
            "start_date",
            "end_date",
        )
