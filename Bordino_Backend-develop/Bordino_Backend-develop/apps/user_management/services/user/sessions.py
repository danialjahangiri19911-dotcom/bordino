"""Login sessions for the JWTs: each login gets a session id (`sid` claim) that every token rotated
from it carries (SimpleJWT copies claims to the access token and keeps them on rotation). Logout
revokes the session, so a copied refresh token — even one already rotated into a newer pair —
and every access token of that session stop working. The revocations are kept in the database
(a cache restart cannot undo one), with the cache in front for the check on every request."""

import uuid

from django.conf import settings
from django.core.cache import cache
from django.utils.translation import gettext_lazy as _

from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken

CLAIM = "sid"


def _key(sid: str) -> str:
    return f"session_revoked:{sid}"


def new_sid() -> str:
    return uuid.uuid4().hex


def revoke(sid: str | None) -> None:
    from apps.user_management.models import RevokedSession  # pylint: disable=import-outside-toplevel

    if not sid:
        return
    RevokedSession.objects.get_or_create(sid=sid)
    cache.set(_key(sid), True, timeout=int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds()))


def is_revoked(sid: str | None) -> bool:
    from apps.user_management.models import RevokedSession  # pylint: disable=import-outside-toplevel

    if not sid:
        return False
    cached = cache.get(_key(sid))
    if cached is None:
        cached = RevokedSession.objects.filter(sid=sid).exists()
        cache.set(_key(sid), cached, timeout=300 if not cached else None)
    return bool(cached)


class SessionRefreshToken(RefreshToken):
    """A refresh token that belongs to a session: refused once the session is revoked. A token
    from before sessions existed is given one now (and keeps it from here on)."""

    def __init__(self, token=None, verify=True):
        super().__init__(token, verify)
        if token is None or not verify:
            return
        sid = self.payload.get(CLAIM)
        if sid and is_revoked(sid):
            raise TokenError(_("This session has been logged out."))
        if not sid:
            self[CLAIM] = new_sid()

    @classmethod
    def for_user(cls, user):
        token = super().for_user(user)
        token[CLAIM] = new_sid()
        return token


class SessionTokenRefreshSerializer(TokenRefreshSerializer):
    """/token/refresh/ within a session: refused once the session is logged out."""

    token_class = SessionRefreshToken
