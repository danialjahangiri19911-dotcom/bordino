from django.contrib.auth import get_user_model
from django.utils.translation import gettext as _
from rest_framework import serializers

from apps.user_management.serializers.otp.utils.otp_exist import OtpExistSerializerMixin
from apps.user_management.services.otp.otp import OTPService

User = get_user_model()


class OTPResendSerializer(OtpExistSerializerMixin, serializers.Serializer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.otp_service = OTPService()

    class Meta:
        fields = OtpExistSerializerMixin.Meta.fields

    def create(self, validated_data):
        user = self.otp_service.resend_otp(
            self.otp_service.ResendDTO(
                validated_data["user"].phone_number,
            )
        )

        return user

    def to_representation(self, instance):  # pylint: disable=unused-argument
        return {"detail": _("verification code has been sent to the phone number")}
