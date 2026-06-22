from django.contrib.admin import register

from apps.django_helper.admin.base import BaseAdmin
from apps.wallet.models.token_wallet_account import TokenWalletAccount


@register(TokenWalletAccount)
class TokenWalletAccountAdmin(BaseAdmin):
    list_display = (
        "id",
        "name",
        "preset_wallet",
        "wallet",
        "token",
        "amount",
        "status",
    )
