from django.utils.translation import gettext as _
from rest_framework import serializers

from apps.user_management.serializers.otp.utils.otp_validate import OtpValidateSerializerMixin
from apps.user_management.services.user.registration import UserRegistrationService


class UserLoginSerializer(OtpValidateSerializerMixin, serializers.Serializer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.user_registration_service = UserRegistrationService()

    referral_code = serializers.CharField(required=False, write_only=True, allow_blank=True)

    class Meta:
        fields = (*OtpValidateSerializerMixin.Meta.fields, "referral_code")

    def validate(self, data):
        request = self.context.get("request")
        if request and "referral_code" not in data:
            referral_code = request.query_params.get("referral_code")
            if referral_code:
                data["referral_code"] = referral_code.strip()
        return super().validate(data)

    def create(self, validated_data):
        referral_code = validated_data.pop("referral_code", None) or None
        if referral_code:
            referral_code = referral_code.strip() or None

        user = self.user_registration_service.login(
            self.user_registration_service.LoginDTO(
                validated_data["user"].phone_number,
                referral_code=referral_code,
            )
        )

        return user

    def to_representation(self, instance):  # pylint: disable=unused-argument
        tokens = self.user_registration_service.issue_token(instance)
        return {
            "tokens": tokens,
            "detail": _("The account has been activated successfully"),
        }
