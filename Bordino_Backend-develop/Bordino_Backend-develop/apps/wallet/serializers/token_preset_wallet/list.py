from apps.django_helper.drf.serializers import BaseModelSerializer
from apps.wallet.models import TokenPresetWallet


class TokenPresetWalletSerializer(BaseModelSerializer):
    class Meta:
        model = TokenPresetWallet
        fields = (
            "name",
            "wallet_type",
            "actions",
            "activation_by",
            "refund_percentage",
            "status",
        )
