from django.contrib import admin
from django.contrib.admin import register

from apps.django_helper.admin.base import BaseAdmin
from apps.lottery.models import LotteryWheelPrize


class LotteryWheelPrizeInline(admin.TabularInline):
    model = LotteryWheelPrize
    extra = 1


@register(LotteryWheelPrize)
class LotteryWheelPrizeAdmin(BaseAdmin):
    list_display = (
        "id",
        "lottery_wheel",
        "prize_amount",
        "probability",
        "prize_type",
    )
