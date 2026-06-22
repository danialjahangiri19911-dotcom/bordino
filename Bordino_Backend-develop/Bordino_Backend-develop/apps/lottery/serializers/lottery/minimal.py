from apps.django_helper.drf.serializers import BaseModelSerializer
from apps.lottery.models import Lottery


class LotteryMinimalSerializer(BaseModelSerializer):
    class Meta:
        model = Lottery
        fields = ("name", "status", "end_date")
