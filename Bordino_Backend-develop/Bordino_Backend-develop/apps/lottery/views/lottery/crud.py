from django.db.models import Prefetch, Q
from rest_framework import mixins
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import OpenApiParameter, extend_schema

from apps.django_helper.drf.mixins.list_serializer import ListSerializerMixin
from apps.django_helper.drf.pagination.custom_page_number import CustomPageNumberPagination
from apps.lottery.models import Lottery, Ticket
from apps.lottery.serializers.lottery.list import LotterySerializer
from apps.lottery.serializers.lottery.minimal import LotteryMinimalSerializer
from apps.lottery.serializers.lottery_results.list import LotteryMatchResultSerializer
from apps.lottery.serializers.lottery_winner.list import LotteryWinnerSerializer
from apps.lottery.serializers.ticket.minimal import TicketMinimalSerializer


class LotteryCRUDView(
    ListSerializerMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    GenericViewSet,
):
    serializer_list_class = LotteryMinimalSerializer  # type: ignore[assignment]
    serializer_class = LotterySerializer
    pagination_class = CustomPageNumberPagination
    permission_classes = (IsAuthenticated,)
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["status"]

    def get_serializer_class(self):
        if self.action == "results":
            return LotteryMatchResultSerializer
        if self.action == "winners":
            return LotteryWinnerSerializer
        if self.action == "my_tickets":
            return TicketMinimalSerializer
        return super().get_serializer_class()

    def get_queryset(self):
        if self.action == "winners":
            return Lottery.objects.filter(status=Lottery.Status.COMPLETED).prefetch_related(
                Prefetch(
                    "tickets",
                    queryset=Ticket.objects.filter(
                        customer_id=self.kwargs["winner_id"],
                        status=Ticket.Status.WINNER,
                    ),
                )
            )

        if self.action == "results":
            return Lottery.objects.filter(status=Lottery.Status.COMPLETED).prefetch_related(
                "tickets",
                "tickets__customer",
                "tickets__customer__user",
            )

        return Lottery.objects.filter(
            Q(status=Lottery.Status.COMPLETED) | Q(status=Lottery.Status.ACTIVE)
        ).prefetch_related(
            "tickets",
            "tickets__customer",
            "tickets__customer__user",
        )

    @extend_schema(
        summary="List all active and completed lotteries",
        description="Get a paginated list of all active and completed lotteries. You can filter by status using query parameter.",
        parameters=[
            OpenApiParameter(
                name="status",
                type=str,
                location=OpenApiParameter.QUERY,
                description="Filter by lottery status (active, completed)",
                required=False,
            ),
        ],
        responses={200: LotteryMinimalSerializer(many=True)},
        tags=["Lottery"],
    )
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    @extend_schema(
        summary="Get lottery results",
        description="Get detailed results of a completed lottery including winning numbers, winners by match count, and prize distribution.",
        responses={
            200: LotteryMatchResultSerializer,
            400: {"type": "object", "properties": {"error": {"type": "string"}}},
        },
        tags=["Lottery"],
    )
    @action(detail=True, methods=["get"], url_path="results")
    def results(self, request, pk):  # pylint: disable=unused-argument
        try:
            lottery = self.get_object()
            serializer = self.get_serializer(lottery)
            return Response(serializer.data)
        except Exception as e:  # pylint: disable=broad-exception-caught
            return Response({"error": f"Error fetching results: {e!s}"}, status=400)

    @extend_schema(
        summary="Get winner details for a specific user",
        description="Get detailed information about a specific winner's tickets and prizes for a completed lottery.",
        parameters=[
            OpenApiParameter(
                name="winner_id",
                type=str,
                location=OpenApiParameter.PATH,
                description="UUID of the winner (customer)",
                required=True,
            ),
        ],
        responses={
            200: LotteryWinnerSerializer,
            400: {"type": "object", "properties": {"error": {"type": "string"}}},
        },
        tags=["Lottery"],
    )
    @action(detail=True, methods=["get"], url_path="results/winners/(?P<winner_id>[^/.]+)")
    def winners(self, request, pk, winner_id):  # pylint: disable=unused-argument
        try:
            lottery = self.get_object()
            serializer = self.get_serializer(lottery)
            return Response(serializer.data)
        except Exception as e:  # pylint: disable=broad-exception-caught
            return Response({"error": f"Error fetching winners: {e!s}"}, status=400)

    @extend_schema(
        summary="Get my tickets for a lottery",
        description="Get all tickets purchased by the authenticated user for a specific lottery.",
        responses={
            200: TicketMinimalSerializer(many=True),
            400: {"type": "object", "properties": {"error": {"type": "string"}}},
        },
        tags=["Lottery"],
    )
    @action(detail=True, methods=["get"], url_path="tickets/me")
    def my_tickets(self, request, pk):  # pylint: disable=unused-argument
        try:
            lottery = self.get_object()
            tickets = lottery.tickets.filter(customer=request.user.customer)
            serializer = self.get_serializer(tickets, many=True)
            return Response(serializer.data)
        except Exception as e:  # pylint: disable=broad-exception-caught
            return Response({"error": f"Error fetching tickets: {e!s}"}, status=400)
