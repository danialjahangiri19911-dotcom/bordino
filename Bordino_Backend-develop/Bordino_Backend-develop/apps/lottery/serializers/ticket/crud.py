from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers
from rest_framework.exceptions import ValidationError as DRFValidationError

from apps.django_helper.drf.serializers import BaseModelSerializer
from apps.lottery.models import Lottery, Ticket
from apps.lottery.services.ticket.purchase import TicketPurchaseService
from apps.lottery.services.lottery.draw import HIGHEST_NUMBER


class TicketCRUDSerializer(BaseModelSerializer):
    """Read-only representation of a ticket (used for ticket detail)."""

    customer = serializers.PrimaryKeyRelatedField(read_only=True)
    name = serializers.CharField(read_only=True)
    reference = serializers.SerializerMethodField()
    ticket_count = serializers.SerializerMethodField()
    update_time = serializers.DateTimeField(read_only=True)
    # وضعیتِ قرعه‌کشیِ این بلیط + شماره‌های برنده و تعداد توپِ منطبق
    # (برای صفحهٔ جزئیاتِ بلیط: سبزکردنِ توپ‌ها و نمایشِ ردیفِ «وضعیت»)
    lottery_status = serializers.CharField(source="lottery.status", read_only=True)
    winning_numbers = serializers.SerializerMethodField()
    matched_count = serializers.SerializerMethodField()

    class Meta:
        model = Ticket
        fields = (
            "name",
            "customer",
            "reference",
            "ticket_count",
            "numbers",
            "update_time",
            "lottery_status",
            "winning_numbers",
            "matched_count",
        )

    def get_reference(self, obj):
        return str(obj.id).replace("-", "")[-8:]

    def get_winning_numbers(self, obj):
        if obj.lottery.status == Lottery.Status.COMPLETED:
            return obj.lottery.numbers or []
        return []

    def get_matched_count(self, obj):
        if obj.lottery.status != Lottery.Status.COMPLETED:
            return None
        winning = set(obj.lottery.numbers or [])
        return len([n for n in (obj.numbers or []) if n in winning])

    def get_ticket_count(self, obj):
        if hasattr(obj, "ticket_count"):
            return obj.ticket_count
        customer = obj.customer if hasattr(obj, "customer") else self.context.get("customer")
        if customer:
            return Ticket.objects.filter(customer=customer, lottery=obj.lottery).count()
        return 1


class TicketPurchaseWithNumbersSerializer(BaseModelSerializer):
    """Create one paid ticket with the given numbers (create-on-submission flow)."""

    numbers = serializers.ListField(
        child=serializers.IntegerField(min_value=1, max_value=100),
        required=True,
    )
    name = serializers.CharField(read_only=True)
    reference = serializers.SerializerMethodField()
    token_wallet_account_id = serializers.CharField(
        required=False, allow_null=True, write_only=True
    )

    class Meta:
        model = Ticket
        fields = (
            "name",
            "reference",
            "numbers",
            "token_wallet_account_id",
        )

    def get_reference(self, obj):
        return str(obj.id).replace("-", "")[-8:]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.ticket_purchase_service = TicketPurchaseService()

    def validate_numbers(self, numbers):
        if len(numbers) != 6:
            raise DRFValidationError(
                _("Invalid numbers. Required: 6, Provided: {}").format(len(numbers))
            )
        if len(set(numbers)) != len(numbers):
            raise DRFValidationError(_("Each number in a ticket must be unique."))
        if any(not 1 <= n <= HIGHEST_NUMBER for n in numbers):
            raise DRFValidationError(_("Numbers must be between 1 and 40."))
        return numbers

    def create(self, validated_data):
        request = self.context.get("request")
        if not request or not getattr(request.user, "customer", None):
            raise DRFValidationError(_("Authentication required with a customer account."))

        try:
            ticket = self.ticket_purchase_service.purchase_with_numbers(
                customer=request.user.customer,
                numbers=validated_data["numbers"],
                token_wallet_account_id=validated_data.get("token_wallet_account_id"),
            )
        except DjangoValidationError as e:
            if hasattr(e, "message_dict"):
                raise DRFValidationError(e.message_dict) from e
            raise DRFValidationError(e.messages if hasattr(e, "messages") else str(e)) from e

        return ticket
