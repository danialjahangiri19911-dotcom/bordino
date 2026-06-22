from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers
from rest_framework.serializers import SerializerMetaclass

from apps.user_management.repositories.otp.command import OTPCommandRepository
from apps.user_management.repositories.user.query import UserQueryRepository

User = get_user_model()


class OtpValidateSerializerMixin(metaclass=SerializerMetaclass):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.otp_command_repository = OTPCommandRepository()

    phone_number = serializers.SlugRelatedField(
        source="user",
        write_only=True,
        queryset=UserQueryRepository.all(),
        slug_field="phone_number",
        error_messages={
            "does_not_exist": _("The phone number provided does not registered yet."),
        },
    )
    otp = serializers.CharField(max_length=settings.OTP_LENGTH)

    class Meta:
        fields = ("code", "phone_number")

    def validate(self, validated_data):
        """
        Perform validation of OTP and its state.
        """

        if "user" not in validated_data:
            raise serializers.ValidationError(_("User data is missing."))

        user = validated_data["user"]
        otp_code = validated_data["otp"]

        # Retrieve the OTP data from Redis
        otp_data = self.otp_command_repository.get_otp(user.phone_number)

        if not otp_data:
            raise serializers.ValidationError(_("OTP not found or expired."))

        # Check if the OTP is already used
        if otp_data.get("is_used"):
            raise serializers.ValidationError(_("OTP has already been used."))

        # Validate the OTP code
        if otp_data.get("otp") != otp_code:
            raise serializers.ValidationError(_("Invalid OTP code."))

        return validated_data  # Return the validated attributes if everything is correct
