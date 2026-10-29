from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers
from rest_framework.serializers import SerializerMetaclass

from apps.user_management.repositories.otp.command import OTPCommandRepository
from apps.user_management.repositories.user.query import UserQueryRepository
from apps.user_management.services.otp.attempts import OtpAttempts
from apps.users.models.user import canonical_phone

User = get_user_model()


class OtpValidateSerializerMixin(metaclass=SerializerMetaclass):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.otp_command_repository = OTPCommandRepository()

    # Looked up in validate(): an unknown number gets the same answer as a known one without a
    # valid code, so the login endpoint does not tell which numbers have accounts.
    phone_number = serializers.CharField(write_only=True)
    otp = serializers.CharField(max_length=settings.OTP_LENGTH)

    class Meta:
        fields = ("code", "phone_number")

    def validate(self, validated_data):
        """
        Perform validation of OTP and its state.
        """

        phone = canonical_phone(validated_data.pop("phone_number", ""))
        user = UserQueryRepository.all().filter(phone_number=phone).first() if phone else None
        if user is None:
            raise serializers.ValidationError(_("OTP not found or expired."))
        validated_data["user"] = user
        otp_code = validated_data["otp"]
        attempts = OtpAttempts(user.phone_number)

        # Retrieve the OTP data from Redis, with a token naming this very code (see `claim`).
        otp_data, claim_token = self.otp_command_repository.read_for_claim(user.phone_number)

        if not otp_data:
            raise serializers.ValidationError(_("OTP not found or expired."))

        # Check if the OTP is already used
        if otp_data.get("is_used"):
            raise serializers.ValidationError(_("OTP has already been used."))

        # Counted before comparing. A code that took too many tries stays blocked until it
        # expires (deleting it would let a new one be sent at once, with fresh guesses).
        limit = attempts.reserve()
        if limit == "day":
            raise serializers.ValidationError(
                _("Too many wrong codes for this number today. Please try again tomorrow.")
            )
        if limit == "code":
            raise serializers.ValidationError(
                _("Too many wrong codes. Wait for this code to expire and request a new one.")
            )

        # Validate the OTP code
        if otp_data.get("otp") != otp_code:
            raise serializers.ValidationError(_("Invalid OTP code."))
        attempts.right_code()

        # Claim the code: delete it only if it is still the code compared above (not a newer one
        # sent meanwhile), atomically; of two requests carrying it, only one goes on.
        if not self.otp_command_repository.claim(user.phone_number, claim_token):
            raise serializers.ValidationError(_("OTP not found or expired."))

        if not user.is_active:
            raise serializers.ValidationError(_("This account has been disabled."))

        return validated_data  # Return the validated attributes if everything is correct
