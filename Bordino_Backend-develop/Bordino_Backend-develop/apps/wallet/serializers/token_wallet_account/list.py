from rest_framework import serializers

from apps.django_helper.drf.serializers import BaseModelSerializer
from apps.lottery.models import Lottery
from apps.wallet.models import TokenWalletAccount


class TokenWalletAccountSerializer(BaseModelSerializer):
    amount = serializers.CharField()

    total_tickets = serializers.SerializerMethodField(read_only=True)
    available_lotteries = serializers.SerializerMethodField(read_only=True)

    def get_total_tickets(self, obj):
        count = 0
        for lottery in obj.token.lotteries.filter(status=Lottery.Status.ACTIVE):
            count += lottery.tickets.filter(customer=obj.wallet.owner.customer).count()
        return str(count)

    def get_available_lotteries(self, obj):
        return obj.token.lotteries.filter(status=Lottery.Status.ACTIVE).values_list("id", flat=True)

    class Meta:
        model = TokenWalletAccount
        fields = (
            "name",
            "token",
            "preset_wallet",
            "status",
            "amount",
            "total_tickets",
            "available_lotteries",
        )
