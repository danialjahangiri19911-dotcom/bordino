from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers
from rest_framework.serializers import SerializerMetaclass

from apps.user_management.repositories.otp.command import OTPCommandRepository
from apps.user_management.repositories.user.query import UserQueryRepository

User = get_user_model()


class OtpExistSerializerMixin(metaclass=SerializerMetaclass):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.otp_command_repository = OTPCommandRepository()
        self.cache_key_prefix = settings.CACHE_KEY_PREFIX

    phone_number = serializers.SlugRelatedField(
        source="user",
        write_only=True,
        queryset=UserQueryRepository.all(),
        slug_field="phone_number",
        error_messages={
            "does_not_exist": _("The phone number provided does not registered yet."),
        },
    )

    class Meta:
        fields = ("phone_number",)

    def validate(self, validated_data):
        if "user" not in validated_data:
            raise serializers.ValidationError(_("User data is missing."))

        user = validated_data["user"]

        otp_data = self.otp_command_repository.get_otp(user.phone_number)

        ttl = cache.ttl(f"{self.cache_key_prefix}{user.phone_number}")

        if otp_data:
            raise serializers.ValidationError(
                _(
                    "OTP already exists. Please wait {ttl} seconds for the current OTP to expire."
                ).format(ttl=ttl)
            )
        return validated_data
