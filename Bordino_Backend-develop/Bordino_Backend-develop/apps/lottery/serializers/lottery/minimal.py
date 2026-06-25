from apps.django_helper.drf.serializers import BaseModelSerializer
from apps.lottery.models import Lottery


class LotteryMinimalSerializer(BaseModelSerializer):
    class Meta:
        model = Lottery
        # `token` تا فرانت بتواند قرعه‌کشی‌ها را بر اساسِ کیفِ امتیازِ کاربر فیلتر کند
        fields = ("name", "status", "end_date", "token")
