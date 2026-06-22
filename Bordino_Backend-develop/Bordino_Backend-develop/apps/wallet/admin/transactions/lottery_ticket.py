from django.contrib import admin

from apps.django_helper.admin.base import BaseAdmin
from apps.wallet.models.transactions.lottery_ticket import LotteryTicketTransaction


@admin.register(LotteryTicketTransaction)
class LotteryTicketTransactionAdmin(BaseAdmin):
    autocomplete_fields = ("customer",)
    list_display = ("id", "lottery", "ticket", "status", "create_time")
