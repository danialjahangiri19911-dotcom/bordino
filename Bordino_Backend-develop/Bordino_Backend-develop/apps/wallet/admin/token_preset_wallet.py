from django.contrib.admin import register

from apps.django_helper.admin.base import BaseAdmin
from apps.wallet.forms.token_preset_wallet import TokenPresetWalletForm
from apps.wallet.models.token_preset_wallet import TokenPresetWallet


@register(TokenPresetWallet)
class TokenPresetWalletAdmin(BaseAdmin):
    form = TokenPresetWalletForm
    list_display = (
        "id",
        "name",
        "wallet_type",
        "activation_by",
        "actions",
        "refund_percentage",
        "default",
    )
