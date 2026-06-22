from django.contrib.admin import register

from apps.django_helper.admin.base import BaseAdmin
from apps.wallet.models.wallet import Wallet


@register(Wallet)
class WalletAdmin(BaseAdmin):
    autocomplete_fields = ("owner",)
    list_display = (
        "id",
        "owner",
        "wallet_type",
        "balance",
    )
