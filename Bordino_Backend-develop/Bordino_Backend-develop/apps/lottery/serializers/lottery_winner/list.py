from django.db.models import Sum
from rest_framework import serializers

from apps.django_helper.drf.serializers import BaseModelSerializer
from apps.lottery.models import Lottery, Ticket
from apps.lottery.serializers.ticket.minimal import TicketMinimalSerializer


class LotteryWinnerSerializer(BaseModelSerializer):
    tickets = TicketMinimalSerializer(many=True)
    total_prize_amount = serializers.SerializerMethodField()
    lottery_numbers = serializers.ListField(source="numbers")
    lottery_id = serializers.UUIDField(source="id")

    class Meta:
        model = Lottery
        fields = [
            "lottery_id",
            "lottery_numbers",
            "tickets",
            "total_prize_amount",
        ]

    def get_total_prize_amount(self, obj):
        return obj.tickets.filter(status=Ticket.Status.WINNER).aggregate(
            total_prize_amount=Sum("prize_amount")
        )["total_prize_amount"]
