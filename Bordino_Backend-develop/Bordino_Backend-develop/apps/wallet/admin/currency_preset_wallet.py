from django.contrib.admin import register

from apps.django_helper.admin.base import BaseAdmin
from apps.wallet.forms.currency_preset_wallet import CurrencyPresetWalletForm
from apps.wallet.models.currency_preset_wallet import CurrencyPresetWallet


@register(CurrencyPresetWallet)
class CurrencyPresetWalletAdmin(BaseAdmin):
    form = CurrencyPresetWalletForm
    list_display = (
        "id",
        "name",
        "currency",
        "wallet_type",
        "activation_by",
        "actions",
        "default",
    )
