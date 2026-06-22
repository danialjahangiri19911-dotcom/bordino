from django.contrib.admin import register

from apps.django_helper.admin.base import BaseAdmin
from apps.lottery.models import LotteryWheelSpin


@register(LotteryWheelSpin)
class LotteryWheelSpinAdmin(BaseAdmin):
    autocomplete_fields = ("customer",)
    list_display = (
        "id",
        "customer",
        "lottery_wheel",
        "count",
    )
