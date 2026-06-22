from rest_framework import serializers


class PointsWalletSummaryItemSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField()
    token = serializers.UUIDField(allow_null=True)
    preset_wallet = serializers.UUIDField()
    wallet_type = serializers.CharField()
    status = serializers.CharField()
    amount = serializers.IntegerField()
    total_points = serializers.DecimalField(max_digits=20, decimal_places=0)
    total_tickets = serializers.IntegerField()
    current_points = serializers.DecimalField(max_digits=20, decimal_places=0)
    required_points = serializers.DecimalField(max_digits=20, decimal_places=0)
    remaining_points = serializers.DecimalField(max_digits=20, decimal_places=0)
    expire_time = serializers.DateTimeField()
