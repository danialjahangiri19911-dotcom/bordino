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
