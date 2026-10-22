# yourapp/serializers.py
import logging

from rest_framework import serializers

from apps.user_management.services.user.logout import LogoutService


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField(write_only=True)
    revoke_access = serializers.BooleanField(default=True, write_only=True)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.logout_service = LogoutService()

    def create(self, validated_data):
        """
        After validation, optionally revoke the access token.
        We'll pop 'revoke_access' from validated_data to decide.
        """
        revoke = validated_data.pop("revoke_access", True)
        refresh = validated_data.pop("refresh")
        try:
            self.logout_service.blacklist_refresh(refresh)
        except Exception as e:  # pylint: disable=broad-except
            # Already blacklisted or expired: the session is over either way.
            logging.info("Logout with an unusable refresh token: %s", e)
        request = self.context.get("request")
        auth = request.META.get("HTTP_AUTHORIZATION", "") if request else ""
        if revoke and auth:
            self.logout_service.revoke_access_jti(
                self.logout_service.RevokeAccessJtiDTO(auth_header=auth)
            )
        return {}
