from rest_framework import serializers

from apps.django_helper.drf.serializers import BaseModelSerializer
from apps.wallet.models import CurrencyTransaction


class CurrencyTransactionSerializer(BaseModelSerializer):
    currency_symbol = serializers.CharField(source="currency.symbol", read_only=True)
    destination_name = serializers.SerializerMethodField()

    def get_destination_name(self, obj):
        if obj.bank_account:
            return f"{obj.bank_account.bank.name} | {obj.bank_account.account_holder}"
        return None

    class Meta:
        model = CurrencyTransaction
        fields = (
            "amount",
            "currency_symbol",
            "destination_name",
            "status",
        )
