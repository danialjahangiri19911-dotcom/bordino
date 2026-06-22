from django.contrib import admin

from apps.django_helper.admin.base import BaseAdmin
from apps.wallet.models.transactions.lottery_wheel_prize import LotteryWheelPrizeTransaction


@admin.register(LotteryWheelPrizeTransaction)
class LotteryWheelPrizeTransactionAdmin(BaseAdmin):
    autocomplete_fields = ("customer",)
    list_display = ("id", "lottery_wheel", "prize", "customer")
