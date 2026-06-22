from rest_framework import mixins
from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import GenericViewSet

from drf_spectacular.utils import OpenApiParameter, extend_schema

from apps.user_management.serializers.customer.step1_profile_setup import StepProfileSetupSerializer
from apps.user_management.serializers.customer.step1_profile_setup_registration import (
    StepProfileSetupRegistrationSerializer,
)
from apps.user_management.views.customer.utils.current_customer import CurrentCustomerMixin
from apps.users.models.customer import Customer


class StepProfileSetupView(
    CurrentCustomerMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    GenericViewSet,
):
    permission_classes = (IsAuthenticated,)

    def get_queryset(self):
        return Customer.objects.filter(user=self.request.user)

    def get_serializer_class(self):
        if self.action == "create":
            return StepProfileSetupRegistrationSerializer
        return StepProfileSetupSerializer

    @extend_schema(
        tags=["onboarding"],
        summary="Create Profile Setup",
        description="Create initial profile setup during registration.",
        request=StepProfileSetupRegistrationSerializer,
        responses={201: StepProfileSetupRegistrationSerializer},
        operation_id="create_profile_setup",
    )
    def create(self, request, *args, **kwargs):
        return super().create(request, *args, **kwargs)

    @extend_schema(
        tags=["onboarding"],
        summary="Get Profile Setup Step",
        description="Retrieve the profile setup step information for the customer.",
        parameters=[
            OpenApiParameter(
                CurrentCustomerMixin.lookup_url_kwarg,
                location=OpenApiParameter.PATH,
                description="Send `me` for the current user or an `UUID` for other users",
            )
        ],
        operation_id="get_profile_setup_step",
    )
    def retrieve(self, request, *args, **kwargs):
        return super().retrieve(request, *args, **kwargs)

    @extend_schema(
        tags=["onboarding"],
        summary="Update Profile Setup Step",
        description="Update the profile setup step information (username, birthdate, gender) for the customer.",
        parameters=[
            OpenApiParameter(
                CurrentCustomerMixin.lookup_url_kwarg,
                location=OpenApiParameter.PATH,
                description="Send `me` for the current user or an `UUID` for other users",
            )
        ],
        operation_id="update_profile_setup_step",
    )
    def partial_update(self, request, *args, **kwargs):
        return super().partial_update(request, *args, **kwargs)
