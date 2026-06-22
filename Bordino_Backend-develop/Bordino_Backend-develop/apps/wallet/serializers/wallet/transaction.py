from rest_framework import serializers

from apps.wallet.serializers.wallet.fields import AbsoluteURLField


class WalletTransactionSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    type = serializers.CharField()
    title = serializers.CharField()
    amount = serializers.DecimalField(max_digits=20, decimal_places=0)
    is_positive = serializers.BooleanField()
    date = serializers.DateField()
    icon = AbsoluteURLField(required=False, allow_null=True)
    reference = serializers.CharField()
