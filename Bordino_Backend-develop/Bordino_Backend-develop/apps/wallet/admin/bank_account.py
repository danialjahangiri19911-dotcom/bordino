from django.contrib.admin import register

from apps.django_helper.admin.base import BaseAdmin
from apps.wallet.models import BankAccount
from apps.wallet.admin.safe_save import LockedOwnershipAdmin


@register(BankAccount)
class BankAccountAdmin(LockedOwnershipAdmin, BaseAdmin):
    locked_on_change = ('user', 'bank', 'iban', 'account_holder')
    autocomplete_fields = ("user",)
    list_display = (
        "id",
        "user",
        "bank",
        "iban",
        "account_holder",
        "status",
        "is_deleted",
        "create_time",
    )
    list_filter = ("status", "bank", "is_deleted")
    search_fields = ("iban", "account_holder", "bank", "user__phone_number")
