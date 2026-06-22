from rest_framework import serializers


class CurrencyWalletSummaryItemSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField()
    preset_wallet = serializers.UUIDField()
    wallet_type = serializers.CharField()
    primary = serializers.BooleanField()
    balance = serializers.DecimalField(max_digits=20, decimal_places=0)
    status = serializers.CharField()
    expire_date = serializers.DateTimeField()


class CurrencyWalletSummarySerializer(serializers.Serializer):
    currency_wallet_accounts = CurrencyWalletSummaryItemSerializer(many=True)
