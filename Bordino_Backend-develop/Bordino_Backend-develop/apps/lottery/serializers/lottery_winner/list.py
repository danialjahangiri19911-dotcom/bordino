from django.db.models import Sum
from rest_framework import serializers

from apps.django_helper.drf.serializers import BaseModelSerializer
from apps.lottery.models import Lottery, Ticket
from apps.lottery.serializers.ticket.minimal import TicketMinimalSerializer
from apps.users.models.customer import Customer


class LotteryWinnerSerializer(BaseModelSerializer):
    tickets = TicketMinimalSerializer(many=True)
    total_prize_amount = serializers.SerializerMethodField()
    lottery_numbers = serializers.ListField(source="numbers")
    lottery_id = serializers.UUIDField(source="id")
    # اطلاعاتِ خودِ برنده برای هدرِ صفحهٔ جزئیات (نام + عکسِ پروفایل)
    username = serializers.SerializerMethodField()
    avatar = serializers.SerializerMethodField()

    class Meta:
        model = Lottery
        fields = [
            "lottery_id",
            "lottery_numbers",
            "tickets",
            "total_prize_amount",
            "username",
            "avatar",
        ]

    def _winner_id(self):
        view = self.context.get("view")
        return view.kwargs.get("winner_id") if view else None

    def _customer(self):
        winner_id = self._winner_id()
        if not winner_id:
            return None
        return Customer.objects.select_related("user", "image").filter(id=winner_id).first()

    def get_total_prize_amount(self, obj):
        # فقط بلیط‌های برندهٔ همین کاربر در این قرعه‌کشی
        queryset = obj.tickets.filter(status=Ticket.Status.WINNER)
        winner_id = self._winner_id()
        if winner_id:
            queryset = queryset.filter(customer_id=winner_id)
        return queryset.aggregate(total_prize_amount=Sum("prize_amount"))["total_prize_amount"]

    def get_username(self, obj):
        customer = self._customer()
        return customer.user.username if customer and customer.user else None

    def get_avatar(self, obj):
        customer = self._customer()
        request = self.context.get("request")
        if customer and customer.image and customer.image.file and request:
            return request.build_absolute_uri(customer.image.file.url)
        return None
