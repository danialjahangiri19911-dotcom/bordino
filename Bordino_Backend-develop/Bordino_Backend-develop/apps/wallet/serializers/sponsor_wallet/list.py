from rest_framework import serializers

from apps.django_helper.drf.serializers import BaseModelSerializer
from apps.wallet.models import Wallet
from apps.wallet.serializers.customer_wallet_account.list import CurrencyWalletAccountSerializer
from apps.wallet.serializers.token_wallet_account.list import TokenWalletAccountSerializer


class SponsorWalletSerializer(BaseModelSerializer):
    currency_wallet_accounts = CurrencyWalletAccountSerializer(many=True, read_only=True)
    token_wallet_accounts = TokenWalletAccountSerializer(many=True, read_only=True)
    split_balance = serializers.DecimalField(max_digits=10, decimal_places=0, read_only=True)

    class Meta:
        model = Wallet
        fields = (
            "owner",
            "wallet_type",
            "split_balance",
            "currency_wallet_accounts",
            "token_wallet_accounts",
        )
