from django.contrib.admin import register

from apps.django_helper.admin.base import BaseAdmin
from apps.wallet.models import CurrencyTransaction


@register(CurrencyTransaction)
class CurrencyTransactionAdmin(BaseAdmin):
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
