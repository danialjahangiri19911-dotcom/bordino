from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers
from rest_framework.serializers import SerializerMetaclass

from apps.user_management.repositories.otp.command import OTPCommandRepository
from apps.user_management.repositories.user.query import UserQueryRepository
from apps.users.models.user import canonical_phone

User = get_user_model()


class OtpExistSerializerMixin(metaclass=SerializerMetaclass):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.otp_command_repository = OTPCommandRepository()
        self.cache_key_prefix = settings.CACHE_KEY_PREFIX

    # Looked up in validate(): an unknown number is answered like a known one (no code is sent),
    # so resend does not tell which numbers have accounts.
    phone_number = serializers.CharField(write_only=True)

    class Meta:
        fields = ("phone_number",)

    def validate(self, validated_data):
        phone = canonical_phone(validated_data.pop("phone_number", ""))
        user = UserQueryRepository.all().filter(phone_number=phone).first() if phone else None
        validated_data["user"] = user
        if user is None:
            return validated_data

        otp_data = self.otp_command_repository.get_otp(user.phone_number)

        if otp_data:
            ttl_of = getattr(cache, "ttl", None)  # Redis only
            ttl = ttl_of(f"{self.cache_key_prefix}{user.phone_number}") if ttl_of else ""
            raise serializers.ValidationError(
                _(
                    "OTP already exists. Please wait {ttl} seconds for the current OTP to expire."
                ).format(ttl=ttl)
            )
        return validated_data
