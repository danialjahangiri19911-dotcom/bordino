from apps.django_helper.drf.serializers import BaseModelSerializer
from apps.wallet.models import Wallet
from apps.wallet.serializers.customer_wallet_account.list import CurrencyWalletAccountSerializer
from apps.wallet.serializers.token_wallet_account.list import TokenWalletAccountSerializer


class WalletSerializer(BaseModelSerializer):
    currency_wallet_accounts = CurrencyWalletAccountSerializer(many=True, read_only=True)
    token_wallet_accounts = TokenWalletAccountSerializer(many=True, read_only=True)

    class Meta:
        model = Wallet
        fields = (
            "owner",
            "wallet_type",
            # "balance",
            "currency_wallet_accounts",
            "token_wallet_accounts",
        )
