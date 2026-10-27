from rest_framework import mixins, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from drf_spectacular.utils import OpenApiParameter, extend_schema

from apps.user_management.serializers.customer.customer_profile import CustomerProfileSerializer
from apps.user_management.serializers.customer.customer_profile_update import (
    CustomerProfileUpdateSerializer,
)
from apps.user_management.services.customer.streak import CustomerStreakService
from apps.user_management.views.customer.utils.current_customer import CurrentCustomerMixin
from apps.users.models.customer import Customer


class CustomerProfileView(
    CurrentCustomerMixin, mixins.RetrieveModelMixin, mixins.UpdateModelMixin, GenericViewSet
):
    serializer_class = CustomerProfileSerializer
    permission_classes = (IsAuthenticated,)
    # PATCH only (no PUT): a partial edit of the player's own name, birthdate and gender.
    http_method_names = ["get", "patch", "head", "options"]

    def get_serializer_class(self):
        if self.action == "partial_update":
            return CustomerProfileUpdateSerializer
        return CustomerProfileSerializer

    def get_queryset(self):
        return Customer.objects.filter(user=self.request.user)

    @extend_schema(
        parameters=[
            OpenApiParameter(
                CurrentCustomerMixin.lookup_url_kwarg,
                location=OpenApiParameter.PATH,
                description="Send `me` for the current user or an `UUID` for other users",
            )
        ]
    )
    def retrieve(self, request, *args, **kwargs):
        # Treat fetching one's own profile as an "app open": bump the
        # consecutive-active-days streak (at most once per local day).
        if kwargs.get(self.lookup_url_kwarg) == "me":
            CustomerStreakService().register_activity(self.get_object())
        return super().retrieve(request, *args, **kwargs)

    @extend_schema(
        request=CustomerProfileUpdateSerializer,
        responses={200: CustomerProfileSerializer},
        summary="Edit my profile (username, birthdate, gender)",
    )
    def partial_update(self, request, *args, **kwargs):
        # Only one's own profile ("me"); answers with the whole profile, as GET does.
        if kwargs.get(self.lookup_url_kwarg) != "me":
            return Response(status=status.HTTP_404_NOT_FOUND)
        customer = self.get_object()
        serializer = CustomerProfileUpdateSerializer(
            customer, data=request.data, partial=True, context=self.get_serializer_context()
        )
        serializer.is_valid(raise_exception=True)
        updated = serializer.save()
        return Response(CustomerProfileSerializer(updated, context=self.get_serializer_context()).data)
