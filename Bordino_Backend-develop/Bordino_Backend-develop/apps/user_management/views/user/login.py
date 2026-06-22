from rest_framework.permissions import AllowAny
from rest_framework.viewsets import GenericViewSet

from drf_spectacular.utils import OpenApiParameter, extend_schema

from apps.django_helper.drf.mixins.ok_model import OKModelMixin
from apps.user_management.serializers.user.login import UserLoginSerializer


@extend_schema(
    tags=["auth"],
    parameters=[
        OpenApiParameter(
            name="referral_code",
            type=str,
            location=OpenApiParameter.QUERY,
            required=False,
            description="Optional referral code to associate with the user account",
        )
    ],
)
class UserLoginView(OKModelMixin, GenericViewSet):
    serializer_class = UserLoginSerializer
    permission_classes = (AllowAny,)
