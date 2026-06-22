from django.contrib.admin import register

from apps.django_helper.admin.base import BaseAdmin
from apps.wallet.models.currency_wallet_account import CurrencyWalletAccount


@register(CurrencyWalletAccount)
class CurrencyWalletAccountAdmin(BaseAdmin):
    list_display = (
        "id",
        "name",
        "preset_wallet",
        "wallet",
        "balance",
        "status",
        "primary",
    )
