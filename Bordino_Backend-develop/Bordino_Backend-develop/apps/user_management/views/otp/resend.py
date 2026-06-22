from rest_framework import mixins
from rest_framework.permissions import AllowAny
from rest_framework.viewsets import GenericViewSet

from drf_spectacular.utils import extend_schema

from apps.user_management.serializers.otp.resend_otp import OTPResendSerializer


@extend_schema(tags=["auth"])
class OtpResendView(mixins.CreateModelMixin, GenericViewSet):
    serializer_class = OTPResendSerializer
    permission_classes = (AllowAny,)
