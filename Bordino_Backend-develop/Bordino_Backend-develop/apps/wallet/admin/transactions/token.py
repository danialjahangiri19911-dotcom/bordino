from django.contrib import admin

from apps.django_helper.admin.base import BaseAdmin
from apps.wallet.models.transactions.token import TokenTransaction
from apps.wallet.admin.safe_save import ReadOnlyLedgerAdmin


@admin.register(TokenTransaction)
class TokenTransactionAdmin(ReadOnlyLedgerAdmin, BaseAdmin):
    list_display = (
        "id",
        "source_wallet",
        "destination_wallet",
        "token",
        "amount",
        "status",
        "create_time",
    )
