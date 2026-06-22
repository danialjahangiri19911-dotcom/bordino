from rest_framework import mixins
from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import GenericViewSet

from drf_spectacular.utils import OpenApiParameter, extend_schema

from apps.user_management.serializers.customer.step4_interest_selection import (
    StepInterestSelectionSerializer,
)
from apps.user_management.views.customer.utils.current_customer import CurrentCustomerMixin
from apps.users.models.customer import Customer


class StepInterestSelectionView(
    CurrentCustomerMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    GenericViewSet,
):
    permission_classes = (IsAuthenticated,)
    serializer_class = StepInterestSelectionSerializer

    def get_queryset(self):
        return Customer.objects.filter(user=self.request.user)

    @extend_schema(
        tags=["onboarding"],
        summary="Get Interest Selection Step",
        description="Retrieve the interest selection step information (favorite categories) for the customer.",
        parameters=[
            OpenApiParameter(
                CurrentCustomerMixin.lookup_url_kwarg,
                location=OpenApiParameter.PATH,
                description="Send `me` for the current user or an `UUID` for other users",
            )
        ],
        operation_id="get_interest_selection_step",
    )
    def retrieve(self, request, *args, **kwargs):
        return super().retrieve(request, *args, **kwargs)

    @extend_schema(
        tags=["onboarding"],
        summary="Update Interest Selection Step",
        description="Update the interest selection step by selecting favorite categories. This completes the onboarding process.",
        parameters=[
            OpenApiParameter(
                CurrentCustomerMixin.lookup_url_kwarg,
                location=OpenApiParameter.PATH,
                description="Send `me` for the current user or an `UUID` for other users",
            )
        ],
        operation_id="update_interest_selection_step",
    )
    def partial_update(self, request, *args, **kwargs):
        return super().partial_update(request, *args, **kwargs)
