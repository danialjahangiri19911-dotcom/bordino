from django.contrib import admin

from apps.django_helper.admin.base import BaseAdmin
from apps.wallet.models.transactions.lottery_ticket import LotteryTicketTransaction


@admin.register(LotteryTicketTransaction)
class LotteryTicketTransactionAdmin(BaseAdmin):
    """Ticket purchases, for reading. Written only by the purchase service: changing one's status or
    deleting it would pay the points back while its ticket stays in the draw (a refund is a points
    adjustment instead, which is recorded)."""

    list_display = ("id", "lottery", "ticket", "customer", "amount", "status", "create_time")
    list_filter = ("status",)
    search_fields = ("customer__user__phone_number",)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
