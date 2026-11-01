from django.contrib import admin

from apps.django_helper.admin.base import BaseAdmin
from apps.wallet.models.transactions.lottery_wheel_prize import LotteryWheelPrizeTransaction
from apps.wallet.admin.safe_save import ReadOnlyLedgerAdmin


@admin.register(LotteryWheelPrizeTransaction)
class LotteryWheelPrizeTransactionAdmin(ReadOnlyLedgerAdmin, BaseAdmin):
    autocomplete_fields = ("customer",)
    list_display = ("id", "lottery_wheel", "prize", "customer")
