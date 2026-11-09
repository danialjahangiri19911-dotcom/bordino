"""Signing in to «بردینو ادمین» and the checks every admin-app request passes.

An admin-app session is its own login (an SMS code to a staff member's phone), with tokens marked
`scope: "ops"`: a player app token never opens the admin app, and an admin-app session is short
(access 30 min, refresh 12 h, then a new code). It belongs to a login session (`sid`), so logging out
ends it everywhere (apps.user_management.services.user.sessions)."""

from datetime import timedelta

from rest_framework.permissions import BasePermission
from rest_framework_simplejwt.exceptions import TokenError

from apps.ops import roles
from apps.ops.models import OpsAuditLog
from apps.user_management.services.user import sessions

SCOPE = "ops"
ACCESS_LIFETIME = timedelta(minutes=30)
REFRESH_LIFETIME = timedelta(hours=12)


def tokens_for(user) -> dict:
    refresh = sessions.SessionRefreshToken.for_user(user)
    refresh["scope"] = SCOPE
    refresh.set_exp(lifetime=REFRESH_LIFETIME)
    access = refresh.access_token
    access.set_exp(lifetime=ACCESS_LIFETIME)
    return {"access": str(access), "refresh": str(refresh)}


def refresh_access(raw: str):
    """A new access token for a live admin-app refresh token whose owner may still sign in."""
    from django.contrib.auth import get_user_model  # pylint: disable=import-outside-toplevel

    try:
        refresh = sessions.SessionRefreshToken(raw)
    except TokenError:
        return None, None
    if refresh.get("scope") != SCOPE:
        return None, None
    user = get_user_model().objects.filter(pk=refresh.get("user_id")).first()
    if not roles.can_sign_in(user):
        return None, None
    access = refresh.access_token
    access.set_exp(lifetime=ACCESS_LIFETIME)
    return user, str(access)


def scope_ok(request) -> bool:
    token = getattr(request, "auth", None)
    try:
        return bool(token) and token.get("scope") == SCOPE
    except AttributeError:
        return False


class IsOps(BasePermission):
    """A signed-in admin-app session of someone who may still use it."""

    message = "برای این کار باید با اپ ادمین وارد شوی."

    def has_permission(self, request, view):
        ok = bool(request.user and request.user.is_authenticated and scope_ok(request) and roles.can_sign_in(request.user))
        if ok:
            roles.ensure_owner(request.user)
        return ok


def role_permission(*needed: str):
    """IsOps plus at least one of these roles ("owner" = an owner)."""

    class HasRole(IsOps):
        message = "این بخش برای نقش تو باز نیست."

        def has_permission(self, request, view):
            if not super().has_permission(request, view):
                return False
            if "owner" in needed and roles.is_owner(request.user):
                return True
            mine = roles.roles_of(request.user)
            return any(r in mine for r in needed if r != "owner")

    HasRole.__name__ = "HasRole_" + "_".join(needed)
    return HasRole


def client_ip(request) -> str | None:
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    return (forwarded.split(",")[0].strip() if forwarded else request.META.get("REMOTE_ADDR")) or None


def audit(request, action: str, target_type: str = "", target_id="", **data):
    OpsAuditLog.objects.create(
        actor=request.user if request.user.is_authenticated else None,
        action=action,
        target_type=target_type,
        target_id=str(target_id or ""),
        data=data,
        ip=client_ip(request),
    )
