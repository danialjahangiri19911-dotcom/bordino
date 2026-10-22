from rest_framework import mixins
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from drf_spectacular.utils import extend_schema

from apps.django_helper.drf.pagination.custom_page_number import CustomPageNumberPagination
from apps.lottery.models import Ticket
from apps.lottery.serializers.ticket.crud import (
    TicketCRUDSerializer,
    TicketPurchaseWithNumbersSerializer,
)


class TicketCRUDView(
    mixins.RetrieveModelMixin,
    GenericViewSet,
):
    serializer_class = TicketCRUDSerializer
    pagination_class = CustomPageNumberPagination
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return Ticket.objects.filter(customer=user.customer)

    def get_serializer_class(self):
        if self.action == "update_numbers":
            return TicketPurchaseWithNumbersSerializer
        return super().get_serializer_class()

    @extend_schema(
        summary="Get ticket details",
        description="Retrieve details of a specific ticket including numbers and status.",
        responses={200: TicketCRUDSerializer},
        tags=["Lottery"],
    )
    def retrieve(self, request, *args, **kwargs):
        return super().retrieve(request, *args, **kwargs)

    @extend_schema(
        summary="Buy a ticket with chosen numbers",
        description="Create and pay for one ticket with 6 different numbers (each 1–40). "
        "Points are deducted atomically as the ticket is created.",
        request=TicketPurchaseWithNumbersSerializer,
        responses={
            201: TicketPurchaseWithNumbersSerializer,
            400: {"type": "object", "properties": {"error": {"type": "string"}}},
        },
        tags=["Lottery"],
    )
    @action(detail=False, methods=["patch"], url_path="numbers")
    def update_numbers(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ticket = serializer.save()
        output = self.get_serializer(ticket)
        return Response(output.data, status=201)
