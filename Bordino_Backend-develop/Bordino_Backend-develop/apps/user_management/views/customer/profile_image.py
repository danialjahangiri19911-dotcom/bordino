from rest_framework import mixins, status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from drf_spectacular.utils import OpenApiParameter, extend_schema

from apps.user_management.serializers.customer.profile_image import CustomerProfileImageSerializer
from apps.user_management.services.customer.profile import CustomerProfileService
from apps.user_management.views.customer.utils.current_customer import CurrentCustomerMixin
from apps.users.models import Customer


class CustomerProfileImageView(
    CurrentCustomerMixin,
    mixins.UpdateModelMixin,
    GenericViewSet,
):
    serializer_class = CustomerProfileImageSerializer
    permission_classes = (IsAuthenticated,)
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        return Customer.objects.filter(user=self.request.user)

    @extend_schema(
        parameters=[
            OpenApiParameter(
                CurrentCustomerMixin.lookup_url_kwarg,
                location=OpenApiParameter.PATH,
                description="Send `me` for the current user or an `UUID` for other users",
            )
        ],
        request={
            "multipart/form-data": {
                "type": "object",
                "properties": {
                    "image": {
                        "type": "string",
                        "format": "binary",
                        "description": "Upload a profile image (max 5MB, supported formats: JPG, PNG, etc.)",
                    }
                },
            }
        },
        responses={200: CustomerProfileImageSerializer},
        description="Upload a profile image. The image will be converted to WebP format.",
        operation_id="upload_profile_image",
    )
    def partial_update(self, request, *args, **kwargs):
        return super().partial_update(request, *args, **kwargs)

    @extend_schema(
        responses={200: CustomerProfileImageSerializer},
        description="Remove my profile picture (the account and everything else stay).",
        operation_id="remove_profile_image",
    )
    def destroy(self, request, *args, **kwargs):
        # Only one's own picture ("me"). This removes the picture, never the customer.
        if kwargs.get(self.lookup_url_kwarg) != "me":
            return Response(status=status.HTTP_404_NOT_FOUND)
        customer = CustomerProfileService().remove_profile_image(self.get_object())
        return Response(self.get_serializer(customer).data)
