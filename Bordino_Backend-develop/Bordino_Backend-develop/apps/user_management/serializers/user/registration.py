from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils.translation import gettext as _
from rest_framework import serializers

from apps.django_helper.drf.serializers import BaseModelSerializer
from apps.user_management.services.user.registration import UserRegistrationService

User = get_user_model()


class UserRegistrationSerializer(BaseModelSerializer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.user_registration_service = UserRegistrationService()

    phone_number = serializers.CharField()

    class Meta:
        model = User
        fields = ("phone_number",)

    def create(self, validated_data):
        user, created = self.user_registration_service.register(
            self.user_registration_service.RegisterDTO(
                validated_data["phone_number"],
            )
        )

        return {"user": user, "created": created}

    def to_representation(self, instance):
        if not instance:
            message = _("Failed to create an account. Please try again later.")

        if instance["created"]:
            status = 1
            next_url = settings.API_LOGIN_ENDPOINT
            message = _("A new user has been registered, and an OTP has been sent.")
        else:
            status = 0
            next_url = settings.API_RESEND_OTP_ENDPOINT
            message = _("User already exists.")

        return {
            "status": status,
            "next_url": next_url,
            "message": message,
        }
