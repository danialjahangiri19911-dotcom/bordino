from django.contrib import admin

from apps.django_helper.admin.base import BaseAdmin
from apps.wallet.models.transactions.lottery_prize import LotteryPrizeTransaction
from apps.wallet.admin.safe_save import ReadOnlyLedgerAdmin


@admin.register(LotteryPrizeTransaction)
class LotteryPrizeTransactionAdmin(ReadOnlyLedgerAdmin, BaseAdmin):
    list_display = ("id", "lottery", "ticket", "prize_amount", "create_time")
