from django.utils.translation import gettext_lazy as _

from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken

from apps.user_management.services.user.logout import LogoutService


class RevocableJWTAuthentication(JWTAuthentication):
    """simplejwt's authentication, plus the access tokens revoked by logout (their jti is kept in
    the cache until they would have expired anyway)."""

    def get_validated_token(self, raw_token):
        token = super().get_validated_token(raw_token)
        if LogoutService.is_access_token_revoked(token.get("jti")):
            raise InvalidToken(_("Token has been revoked."))
        return token
