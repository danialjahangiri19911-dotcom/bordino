from rest_framework import serializers

from apps.wallet.serializers.wallet.summary_item import PointsWalletSummaryItemSerializer


class PointsWalletSummarySerializer(serializers.Serializer):
    token_wallet_accounts = PointsWalletSummaryItemSerializer(many=True)
