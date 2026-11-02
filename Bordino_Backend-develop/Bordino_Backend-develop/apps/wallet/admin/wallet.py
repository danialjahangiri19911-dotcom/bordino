from django.contrib.admin import register

from apps.django_helper.admin.base import BaseAdmin
from apps.wallet.models.wallet import Wallet
from apps.wallet.admin.safe_save import LockedOwnershipAdmin


@register(Wallet)
class WalletAdmin(LockedOwnershipAdmin, BaseAdmin):
    locked_on_change = ('owner', 'wallet_type')
    autocomplete_fields = ("owner",)
    list_display = (
        "id",
        "owner",
        "wallet_type",
        "balance",
    )
