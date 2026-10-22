from rest_framework import serializers

from apps.django_helper.drf.serializers import BaseModelSerializer
from apps.lottery.models import Lottery


class LotteryMinimalSerializer(BaseModelSerializer):
    # «مبلغ جایزه» برای نمایش در خانه (بالای شمارش معکوس)
    balance_in_money = serializers.SerializerMethodField()

    # The prize per number of matching balls, as settlement pays it (shown in the guide).
    prize_rules = serializers.SerializerMethodField()

    def get_balance_in_money(self, obj):
        return str(obj.prize_amount_in_money)

    def get_prize_rules(self, obj):
        return [
            {"match_count": rule.match_count, "prize_amount": str(int(rule.prize_amount))}
            for rule in sorted(obj.prize_rules.all(), key=lambda r: r.match_count)
        ]

    class Meta:
        model = Lottery
        # `token` تا فرانت بتواند قرعه‌کشی‌ها را بر اساسِ کیفِ امتیازِ کاربر فیلتر کند
        # `ticket_price`: the purchase sends back the price the player saw.
        fields = (
            "id", "name", "status", "end_date", "token", "balance_in_money", "ticket_price",
            "prize_rules",
        )
