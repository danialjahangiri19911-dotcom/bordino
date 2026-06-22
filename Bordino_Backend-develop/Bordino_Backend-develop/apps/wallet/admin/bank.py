from django.contrib.admin import register

from apps.django_helper.admin.base import BaseAdmin
from apps.wallet.models import Bank


@register(Bank)
class BankAdmin(BaseAdmin):
    list_display = ("id", "name", "code", "icon", "is_active", "create_time")
    list_filter = ("is_active",)
    search_fields = ("name", "code")
