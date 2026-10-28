from rest_framework import serializers

from apps.django_helper.drf.serializers import BaseModelSerializer
from apps.lottery.models import Lottery, Ticket
from apps.lottery.repositories.lottery.query import LotteryQueryRepository
from apps.users.models.customer import Customer


class WinningTicketSerializer(BaseModelSerializer):
    """
    Serializer for individual winning tickets.
    """

    numbers = serializers.ListField()
    matched_count = serializers.IntegerField(source="matched_numbers")
    prize_amount = serializers.DecimalField(max_digits=20, decimal_places=0)

    class Meta:
        model = Ticket
        fields = ["numbers", "matched_count", "prize_amount", "status"]


class CustomerWinnerSerializer(serializers.Serializer):
    """
    Serializer for customer winner information.
    """

    # Other players are shown as a masked name with their prize — no id, avatar or ticket numbers;
    # the requester's own entry is complete (is_me).
    customer_id = serializers.SerializerMethodField()
    is_me = serializers.SerializerMethodField()
    username = serializers.SerializerMethodField()
    avatar = serializers.SerializerMethodField()
    prize_amount = serializers.DecimalField(
        source="total_prize_amount", max_digits=20, decimal_places=0
    )
    tickets_count = serializers.IntegerField()
    highest_match = serializers.IntegerField()
    winning_tickets = serializers.SerializerMethodField()

    def _mine(self, obj) -> bool:
        request = self.context.get("request")
        me = getattr(getattr(request, "user", None), "customer", None)
        return bool(me) and str(me.pk) == str(obj["customer_id"])

    def get_is_me(self, obj):
        return self._mine(obj)

    def get_customer_id(self, obj):
        return str(obj["customer_id"]) if self._mine(obj) else None

    def get_username(self, obj):
        customer_info = self.context.get("customer_info") or {}
        name = customer_info.get(str(obj["customer_id"]), {}).get("username") or ""
        if self._mine(obj) or not name:
            return name or None
        return name[0] + "***"

    def get_avatar(self, obj):
        if not self._mine(obj):
            return None
        customer_info = self.context.get("customer_info") or {}
        return customer_info.get(str(obj["customer_id"]), {}).get("avatar")

    def get_winning_tickets(self, obj):
        if not self._mine(obj):
            return []
        tickets = Ticket.objects.filter(id__in=obj["winning_tickets"]).select_related(
            "customer", "customer__user"
        )
        return WinningTicketSerializer(tickets, many=True).data


class MatchGroupSerializer(serializers.Serializer):
    """
    Serializer for match group results.
    """

    matched_numbers = serializers.IntegerField()
    winners_count = serializers.IntegerField()
    total_prize = serializers.DecimalField(max_digits=20, decimal_places=0)
    average_prize_per_winner = serializers.DecimalField(max_digits=20, decimal_places=0)
    winners = CustomerWinnerSerializer(many=True)


class LotteryMatchResultSerializer(BaseModelSerializer):
    """
    Main serializer for lottery results.
    """

    winning_numbers = serializers.ListField(source="numbers")
    total_winners = serializers.SerializerMethodField()
    total_prize_pool = serializers.SerializerMethodField()
    results_by_match = serializers.SerializerMethodField()
    summary = serializers.SerializerMethodField()

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.lottery_query_repository = LotteryQueryRepository()

    class Meta:
        model = Lottery
        fields = [
            "name",
            "status",
            "end_date",
            "winning_numbers",
            "total_winners",
            "total_prize_pool",
            "summary",
            "results_by_match",
        ]

    def get_total_winners(self, lottery):
        return self.lottery_query_repository.get_total_winners(lottery)

    def get_total_prize_pool(self, lottery):
        return lottery.prize_amount_in_money

    def get_summary(self, lottery):
        return self.lottery_query_repository.get_summary(lottery)

    def get_results_by_match(self, lottery):
        results = self.lottery_query_repository.get_results_by_match(lottery)
        customer_ids = set()
        for match_group in results:
            for winner in match_group.get("winners", []):
                customer_ids.add(winner["customer_id"])

        customer_info = {}
        if customer_ids:
            request = self.context.get("request")
            customers = Customer.objects.filter(id__in=customer_ids).select_related("user", "image")
            for customer in customers:
                avatar = None
                if customer.image and customer.image.file and request:
                    avatar = request.build_absolute_uri(customer.image.file.url)
                customer_info[str(customer.id)] = {
                    "username": customer.user.username if customer.user else None,
                    "avatar": avatar,
                }

        context = {**self.context, "customer_info": customer_info}
        return MatchGroupSerializer(results, many=True, context=context).data
