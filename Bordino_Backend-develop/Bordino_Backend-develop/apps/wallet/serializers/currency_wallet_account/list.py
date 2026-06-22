from apps.django_helper.drf.serializers import BaseModelSerializer
from apps.wallet.models import CurrencyWalletAccount


class CurrencyWalletAccountSerializer(BaseModelSerializer):
    class Meta:
        model = CurrencyWalletAccount
        fields = (
            "name",
            "preset_wallet",
            "primary",
            "status",
            "balance",
        )
