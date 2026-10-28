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
    # Cash moves only through transactions (withdrawals, prizes): an edited balance would have no
    # history and could overwrite a payment made at the same moment.
    readonly_fields = ("balance",)
