from django.contrib.admin import register

from apps.django_helper.admin.base import BaseAdmin
from apps.lottery.models import Ticket


@register(Ticket)
class TicketAdmin(BaseAdmin):
    autocomplete_fields = ("customer",)
    list_display = (
        "id",
        "name",
        "lottery",
        "customer",
        "numbers",
        "status",
    )

    # Tickets are bought (points paid, pool counted), never typed in: no adding here, and what was
    # bought (lottery, player, numbers) stays as it was.
    def has_add_permission(self, request):
        return False

    def get_readonly_fields(self, request, obj=None):
        return ("lottery", "customer", "numbers") if obj else ()
