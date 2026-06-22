from django.db.models import Count, F, Sum, Window
from django.db.models.expressions import RawSQL
from rest_framework import mixins
from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import GenericViewSet

from apps.django_helper.drf.mixins.list_serializer import ListSerializerMixin
from apps.django_helper.drf.pagination.custom_page_number import CustomPageNumberPagination
from apps.wallet.models import LotteryTicketTransaction
from apps.wallet.serializers.lottery_ticket_transaction.minimal import (
    LotteryTicketTransactionSerializer,
)


class LotteryTicketTransactionCRUDView(
    ListSerializerMixin,
    mixins.ListModelMixin,
    GenericViewSet,
):
    serializer_list_class = LotteryTicketTransactionSerializer  # type: ignore[assignment]
    pagination_class = CustomPageNumberPagination
    permission_classes = (IsAuthenticated,)

    def get_queryset(self):
        user = self.request.user

        return (
            LotteryTicketTransaction.objects.filter(customer=user.customer)
            .annotate(
                date=RawSQL(
                    """
                date_trunc('hour', create_time)
                + floor(date_part('minute', create_time) / 15) * interval '15 minutes'
                """,
                    [],
                )
            )
            .annotate(
                txn_count=Window(
                    expression=Count("pk"),
                    partition_by=[F("customer"), F("lottery"), F("date")],
                ),
                amount_sum=Window(
                    expression=Sum("amount"),
                    partition_by=[F("customer"), F("lottery"), F("date")],
                ),
            )
            .order_by("-date")
            .distinct("date")
            .values("date", "txn_count", "amount_sum", "create_time")
        )
