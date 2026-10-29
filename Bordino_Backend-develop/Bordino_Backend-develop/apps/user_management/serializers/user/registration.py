import re

from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils.translation import gettext as _
from rest_framework import serializers

from apps.django_helper.drf.serializers import BaseModelSerializer
from apps.user_management.services.otp.otp import OtpNotSent
from apps.user_management.services.user.registration import UserRegistrationService
from apps.users.models.user import canonical_phone

User = get_user_model()


class UserRegistrationSerializer(BaseModelSerializer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.user_registration_service = UserRegistrationService()

    phone_number = serializers.CharField()

    def validate_phone_number(self, value):
        phone = canonical_phone(value)
        if not re.fullmatch(r"9[0-9]{9}", phone):
            raise serializers.ValidationError(_("Use a digit number starting with 9."))
        return phone

    class Meta:
        model = User
        fields = ("phone_number",)

    def create(self, validated_data):
        try:
            user, created = self.user_registration_service.register(
                self.user_registration_service.RegisterDTO(
                    validated_data["phone_number"],
                )
            )
        except OtpNotSent as exc:
            if exc.too_many:
                raise serializers.ValidationError(
                    _("Too many codes requested for this number. Please try again in an hour.")
                ) from exc
            raise serializers.ValidationError(
                _("The SMS could not be sent. Please try again in a moment.")
            ) from exc

        return {"user": user, "created": created}

    def to_representation(self, instance):  # pylint: disable=unused-argument
        # The same answer for a new number and a known one (a code is sent either way): the answer
        # must not tell anyone which numbers have accounts.
        return {
            "status": 1,
            "next_url": settings.API_LOGIN_ENDPOINT,
            "message": _("A verification code has been sent."),
        }
