from rest_framework import mixins
from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import GenericViewSet

from drf_spectacular.utils import OpenApiParameter, extend_schema

from apps.user_management.serializers.customer.step3_usage_goal import StepUsageGoalSerializer
from apps.user_management.views.customer.utils.current_customer import CurrentCustomerMixin
from apps.users.models.customer import Customer


class StepUsageGoalView(
    CurrentCustomerMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    GenericViewSet,
):
    permission_classes = (IsAuthenticated,)
    serializer_class = StepUsageGoalSerializer

    def get_queryset(self):
        return Customer.objects.filter(user=self.request.user)

    @extend_schema(
        tags=["onboarding"],
        summary="Get Usage Goal Step",
        description="Retrieve the usage goal step information (signup reasons) for the customer.",
        parameters=[
            OpenApiParameter(
                CurrentCustomerMixin.lookup_url_kwarg,
                location=OpenApiParameter.PATH,
                description="Send `me` for the current user or an `UUID` for other users",
            )
        ],
        operation_id="get_usage_goal_step",
    )
    def retrieve(self, request, *args, **kwargs):
        return super().retrieve(request, *args, **kwargs)

    @extend_schema(
        tags=["onboarding"],
        summary="Update Usage Goal Step",
        description="Update the usage goal step by selecting signup reasons.",
        parameters=[
            OpenApiParameter(
                CurrentCustomerMixin.lookup_url_kwarg,
                location=OpenApiParameter.PATH,
                description="Send `me` for the current user or an `UUID` for other users",
            )
        ],
        operation_id="update_usage_goal_step",
    )
    def partial_update(self, request, *args, **kwargs):
        return super().partial_update(request, *args, **kwargs)
