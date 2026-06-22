from rest_framework import mixins
from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import GenericViewSet

from drf_spectacular.utils import OpenApiParameter, extend_schema

from apps.user_management.serializers.customer.customer_profile import CustomerProfileSerializer
from apps.user_management.services.customer.streak import CustomerStreakService
from apps.user_management.views.customer.utils.current_customer import CurrentCustomerMixin
from apps.users.models.customer import Customer


class CustomerProfileView(CurrentCustomerMixin, mixins.RetrieveModelMixin, GenericViewSet):
    serializer_class = CustomerProfileSerializer
    permission_classes = (IsAuthenticated,)

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
