from rest_framework import mixins
from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import GenericViewSet

from drf_spectacular.utils import OpenApiParameter, extend_schema

from apps.user_management.serializers.customer.step2_daily_usage_time import (
    StepDailyUsageTimeSerializer,
)
from apps.user_management.views.customer.utils.current_customer import CurrentCustomerMixin
from apps.users.models.customer import Customer


class StepDailyUsageTimeView(
    CurrentCustomerMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    GenericViewSet,
):
    permission_classes = (IsAuthenticated,)
    serializer_class = StepDailyUsageTimeSerializer

    def get_queryset(self):
        return Customer.objects.filter(user=self.request.user)

    @extend_schema(
        tags=["onboarding"],
        summary="Get Daily Usage Time Step",
        description="Retrieve the daily usage time step information for the customer.",
        parameters=[
            OpenApiParameter(
                CurrentCustomerMixin.lookup_url_kwarg,
                location=OpenApiParameter.PATH,
                description="Send `me` for the current user or an `UUID` for other users",
            )
        ],
        operation_id="get_daily_usage_time_step",
    )
    def retrieve(self, request, *args, **kwargs):
        return super().retrieve(request, *args, **kwargs)

    @extend_schema(
        tags=["onboarding"],
        summary="Update Daily Usage Time Step",
        description="Update the daily usage time step by selecting a daily usage duration option.",
        parameters=[
            OpenApiParameter(
                CurrentCustomerMixin.lookup_url_kwarg,
                location=OpenApiParameter.PATH,
                description="Send `me` for the current user or an `UUID` for other users",
            )
        ],
        operation_id="update_daily_usage_time_step",
    )
    def partial_update(self, request, *args, **kwargs):
        return super().partial_update(request, *args, **kwargs)
