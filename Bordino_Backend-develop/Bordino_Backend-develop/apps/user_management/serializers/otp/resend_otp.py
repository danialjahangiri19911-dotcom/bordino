from django.contrib.auth import get_user_model
from django.utils.translation import gettext as _
from rest_framework import serializers

from apps.user_management.serializers.otp.utils.otp_exist import OtpExistSerializerMixin
from apps.user_management.services.otp.otp import OtpNotSent, OTPService

User = get_user_model()


class OTPResendSerializer(OtpExistSerializerMixin, serializers.Serializer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.otp_service = OTPService()

    class Meta:
        fields = OtpExistSerializerMixin.Meta.fields

    def create(self, validated_data):
        try:
            user = self.otp_service.resend_otp(
                self.otp_service.ResendDTO(
                    validated_data["user"].phone_number,
                )
            )
        except OtpNotSent as e:
            if e.too_many:
                raise serializers.ValidationError(
                    _("Too many codes requested for this number. Please try again in an hour.")
                ) from e
            raise serializers.ValidationError(
                _("The SMS could not be sent. Please try again in a moment.")
            ) from e

        return user

    def to_representation(self, instance):  # pylint: disable=unused-argument
        return {"detail": _("verification code has been sent to the phone number")}
