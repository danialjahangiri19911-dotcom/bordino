from django.contrib.admin import register

from apps.django_helper.admin.base import BaseAdmin
from apps.wallet.models import CurrencyTransaction


@register(CurrencyTransaction)
class CurrencyTransactionAdmin(BaseAdmin):
    # A withdrawal is never deleted: its record (and request id, which stops a replay) stays; a
    # pending one is cancelled through its status, which returns the money once.
    def has_delete_permission(self, request, obj=None):
        return False

    list_display = (
        "id",
        "amount",
        "currency",
        "source_wallet",
        "destination_wallet",
        "bank_account",
        "status",
        "create_time",
    )
    list_filter = ("status", "currency")
    # Only the status is decided here; what was reserved stays as requested.
    readonly_fields = ("amount", "currency", "source_wallet", "destination_wallet", "bank_account")
    search_fields = ("bank_account__iban", "bank_account__account_holder")
