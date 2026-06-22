from apps.django_helper.drf.serializers import BaseModelSerializer
from apps.wallet.models import CurrencyPresetWallet


class CurrencyPresetWalletSerializer(BaseModelSerializer):
    class Meta:
        model = CurrencyPresetWallet
        fields = (
            "name",
            "currency",
            "wallet_type",
            "actions",
            "activation_by",
            "status",
        )
