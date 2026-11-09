"""«بردینو ادمین»: sign in (SMS code), me, staff (owner only), audit log."""

from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from apps.ops import roles
from apps.ops.auth import IsOps, audit, refresh_access, role_permission, tokens_for
from apps.ops.models import OpsAuditLog, OpsMember
from apps.user_management import admin_otp
from apps.user_management.services.user import sessions


def err(message: str, code: str = "invalid", status: int = 400, **extra):
    return Response({"error": message, "code": code, **extra}, status=status)


class OpsAuthThrottle(AnonRateThrottle):
    scope = "ops_auth"
    rate = "20/min"


SEND_TEXT = {
    "sent": "اگر این شماره عضو اپ ادمین باشد، کد ورود پیامک شد.",
    "wait": "کمی صبر کن؛ هر دقیقه فقط یک کد فرستاده می‌شود.",
    "limit": "در این ساعت کد زیادی خواسته شده؛ بعداً دوباره امتحان کن.",
    "sms_failed": "ارسال پیامک نشد؛ دوباره امتحان کن.",
}


class SendCodeView(APIView):
    """A code by SMS to a staff member's phone (any other number gets the same answer, no SMS)."""

    authentication_classes = ()
    permission_classes = (AllowAny,)
    throttle_classes = (OpsAuthThrottle,)

    def post(self, request):
        phone = admin_otp.normalize_phone((request.data or {}).get("phone"))
        if not phone:
            return err("شمارهٔ موبایل معتبر نیست.")
        result = admin_otp.send_code(phone, who=roles.user_for_phone, scope="ops")
        if result != "sent":
            return err(SEND_TEXT[result], result, 429 if result in ("wait", "limit") else 502)
        return Response({"message": SEND_TEXT["sent"]})


class VerifyCodeView(APIView):
    authentication_classes = ()
    permission_classes = (AllowAny,)
    throttle_classes = (OpsAuthThrottle,)

    def post(self, request):
        data = request.data or {}
        phone = admin_otp.normalize_phone(data.get("phone"))
        user = admin_otp.verify_code(phone, data.get("code"), who=roles.user_for_phone, scope="ops") if phone else None
        if user is None:
            return err("کد نادرست یا منقضی است.", "bad_code", 400)
        request.user = user
        audit(request, "sign_in", "user", user.pk)
        return Response({"tokens": tokens_for(user), "me": me_payload(user)})


class RefreshView(APIView):
    authentication_classes = ()
    permission_classes = (AllowAny,)
    throttle_classes = (OpsAuthThrottle,)

    def post(self, request):
        user, access = refresh_access(str((request.data or {}).get("refresh") or ""))
        if user is None:
            return err("نشست تمام شده؛ دوباره وارد شو.", "signed_out", 401)
        return Response({"access": access})


class LogoutView(APIView):
    permission_classes = (IsOps,)

    def post(self, request):
        sessions.revoke(request.auth.get(sessions.CLAIM))
        audit(request, "sign_out", "user", request.user.pk)
        return Response({"ok": True})


def me_payload(user) -> dict:
    return {
        "id": str(user.pk),
        "phone": "0" + user.phone_number if user.phone_number else "",
        "name": user.username or "",
        "owner": roles.is_owner(user),
        "roles": roles.roles_of(user),
    }


class MeView(APIView):
    permission_classes = (IsOps,)

    def get(self, request):
        return Response({"me": me_payload(request.user), "roles": {k: {"name": v[1], "what": v[3]} for k, v in roles.ROLES.items()}})


# ── staff (owner only) ──


def staff_payload(m: OpsMember) -> dict:
    u = m.user
    return {
        "id": str(m.pk),
        "user_id": str(u.pk),
        "phone": "0" + u.phone_number,
        "name": u.username or "",
        "active": m.is_active,
        "roles": [k for k, (g, *_r) in roles.ROLES.items() if g in set(u.groups.values_list("name", flat=True))],
        "note": m.note,
        "added": m.create_time.isoformat(),
        "owner": roles.is_owner(u),
    }


class StaffView(APIView):
    permission_classes = (role_permission("owner"),)

    def get(self, request):
        User = get_user_model()
        owners = [
            {"id": "", "user_id": str(u.pk), "phone": "0" + u.phone_number, "name": u.username or "", "active": True, "roles": list(roles.ROLES), "note": "", "added": None, "owner": True}
            for u in User.objects.filter(phone_number__in=roles.owners())
        ]
        members = [staff_payload(m) for m in OpsMember.objects.select_related("user").order_by("-create_time") if not roles.is_owner(m.user)]
        return Response({"staff": owners + members})

    def post(self, request):
        """Adds a staff member by phone (a registered Bordino account) with these roles."""
        data = request.data or {}
        phone = admin_otp.normalize_phone(data.get("phone"))
        wanted = [r for r in (data.get("roles") or []) if r in roles.ROLES]
        if not phone:
            return err("شمارهٔ موبایل معتبر نیست.")
        user = get_user_model().objects.filter(phone_number=phone).first()
        if user is None:
            return err("این شماره هنوز در بردینو ثبت‌نام نکرده است؛ اول با همین شماره در اپ بردینو ثبت‌نام کند.", "not_registered", 404)
        if roles.is_owner(user):
            return err("این شماره مدیر اصلی است و همهٔ نقش‌ها را دارد.", "owner", 409)
        if not wanted:
            return err("دست‌کم یک نقش انتخاب کن.")
        with transaction.atomic():
            m, created = OpsMember.objects.get_or_create(user=user, defaults={"added_by": request.user, "note": str(data.get("note") or "")[:200]})
            if not created:
                m.is_active = True
                m.save(update_fields=["is_active", "update_time"])
            roles.set_roles(user, wanted)
            audit(request, "staff_add" if created else "staff_reactivate", "user", user.pk, phone="0" + phone, roles=wanted)
        return Response({"member": staff_payload(m)}, status=201 if created else 200)


class StaffMemberView(APIView):
    permission_classes = (role_permission("owner"),)

    def _get(self, member_id):
        return OpsMember.objects.select_related("user").filter(pk=member_id).first()

    def patch(self, request, member_id):
        m = self._get(member_id)
        if m is None or roles.is_owner(m.user):
            return err("پیدا نشد.", "not_found", 404)
        data = request.data or {}
        before = staff_payload(m)
        with transaction.atomic():
            if "roles" in data:
                wanted = [r for r in (data.get("roles") or []) if r in roles.ROLES]
                if not wanted:
                    return err("دست‌کم یک نقش بماند؛ برای کنار گذاشتن، غیرفعالش کن.")
                roles.set_roles(m.user, wanted)
            if "active" in data:
                m.is_active = bool(data.get("active"))
            if "note" in data:
                m.note = str(data.get("note") or "")[:200]
            m.save()
            after = staff_payload(m)
            audit(request, "staff_change", "user", m.user_id, before={k: before[k] for k in ("roles", "active", "note")}, after={k: after[k] for k in ("roles", "active", "note")})
        return Response({"member": after})

    def delete(self, request, member_id):
        m = self._get(member_id)
        if m is None or roles.is_owner(m.user):
            return err("پیدا نشد.", "not_found", 404)
        with transaction.atomic():
            roles.set_roles(m.user, [])
            audit(request, "staff_remove", "user", m.user_id, phone="0" + m.user.phone_number)
            m.delete()
        return Response({"ok": True})


class AuditView(APIView):
    """The owner sees everything; everyone else their own actions."""

    permission_classes = (IsOps,)

    def get(self, request):
        qs = OpsAuditLog.objects.select_related("actor").order_by("-create_time")
        if not roles.is_owner(request.user):
            qs = qs.filter(actor=request.user)
        action = request.query_params.get("action")
        if action:
            qs = qs.filter(action=action)
        try:
            offset = max(0, int(request.query_params.get("offset") or 0))
        except ValueError:
            offset = 0
        rows = list(qs[offset : offset + 50])
        return Response(
            {
                "rows": [
                    {
                        "at": r.create_time.isoformat(),
                        "actor": ("0" + r.actor.phone_number) if r.actor else "",
                        "actor_name": (r.actor.username or "") if r.actor else "",
                        "action": r.action,
                        "target": f"{r.target_type}:{r.target_id}" if r.target_type else "",
                        "data": r.data,
                    }
                    for r in rows
                ],
                "more": len(rows) == 50,
            }
        )
