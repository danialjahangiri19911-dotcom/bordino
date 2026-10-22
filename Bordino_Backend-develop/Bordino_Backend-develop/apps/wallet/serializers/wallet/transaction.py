from rest_framework import serializers

from apps.wallet.serializers.wallet.fields import AbsoluteURLField


class WalletTransactionSerializer(serializers.Serializer):
    id = serializers.CharField()
    type = serializers.CharField()
    title = serializers.CharField()
    amount = serializers.DecimalField(max_digits=20, decimal_places=0)
    is_positive = serializers.BooleanField()
    # The moment, with its time zone (the app shows it in Tehran time), not just the day.
    date = serializers.DateTimeField()
    icon = AbsoluteURLField(required=False, allow_null=True)
    reference = serializers.CharField()
    # Currency rows: a withdrawal's state ("pending", …) and its Persian label; otherwise null.
    status = serializers.CharField(allow_null=True, required=False)
    status_label = serializers.CharField(allow_null=True, required=False)
    destination_name = serializers.CharField(allow_null=True, required=False)
