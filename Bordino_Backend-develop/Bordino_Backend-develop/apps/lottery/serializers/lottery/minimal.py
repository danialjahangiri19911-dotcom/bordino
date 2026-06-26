from rest_framework import serializers

from apps.django_helper.drf.serializers import BaseModelSerializer
from apps.lottery.models import Lottery


class LotteryMinimalSerializer(BaseModelSerializer):
    # «مبلغ جایزه» برای نمایش در خانه (بالای شمارش معکوس)
    balance_in_money = serializers.SerializerMethodField()

    def get_balance_in_money(self, obj):
        return str(obj.prize_amount_in_money)

    class Meta:
        model = Lottery
        # `token` تا فرانت بتواند قرعه‌کشی‌ها را بر اساسِ کیفِ امتیازِ کاربر فیلتر کند
        fields = ("id", "name", "status", "end_date", "token", "balance_in_money")
