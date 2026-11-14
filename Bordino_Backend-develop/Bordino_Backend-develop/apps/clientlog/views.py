from django.utils.dateparse import parse_datetime
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from apps.clientlog import services
from apps.ops.auth import role_permission

FLOWS = {"profile_photo", "mission_photo"}


class LogThrottle(UserRateThrottle):
    scope = "clientlog"
    rate = "120/min"


class ClientLogView(APIView):
    """The app's steps of a flow: {"flow", "attempt", "env", "events": [{"step", "level", "data", "at"}]}."""

    permission_classes = (IsAuthenticated,)
    throttle_classes = (LogThrottle,)

    def post(self, request):
        body = request.data if isinstance(request.data, dict) else {}
        flow = str(body.get("flow") or "")
        if flow not in FLOWS:
            return Response({"error": "unknown flow"}, status=400)
        events = body.get("events") if isinstance(body.get("events"), list) else []
        env = body.get("env") if isinstance(body.get("env"), dict) else {}
        ua = request.META.get("HTTP_USER_AGENT", "")
        forwarded = (request.META.get("HTTP_X_FORWARDED_FOR") or "").split(",")[0].strip()
        ip = forwarded or request.META.get("REMOTE_ADDR")
        for i, e in enumerate(events[:30]):
            if not isinstance(e, dict):
                continue
            data = e.get("data") if isinstance(e.get("data"), dict) else {}
            if i == 0 and env:
                data = {**data, "env": env}
            services.record(
                request.user, flow, str(e.get("step") or "?"), attempt=str(body.get("attempt") or ""),
                level=str(e.get("level") or "info"), data=data, source="app", user_agent=ua, ip=ip or None,
                client_time=parse_datetime(str(e.get("at") or "")) if e.get("at") else None,
            )
        return Response({"saved": min(len(events), 30)})


class OpsClientLogView(APIView):
    """«بردینو ادمین»: a player's latest traced steps (any staff role), newest first."""

    permission_classes = (role_permission("reviewer", "finance", "settings", "support"),)

    def get(self, request):
        from apps.clientlog.models import ClientLog  # pylint: disable=import-outside-toplevel

        phone = "".join(ch for ch in str(request.query_params.get("phone") or "") if ch.isdigit())[-10:]
        rows = ClientLog.objects.all()
        if phone:
            rows = rows.filter(phone=phone)
        if request.query_params.get("flow"):
            rows = rows.filter(flow=request.query_params["flow"])
        return Response({"logs": [
            {"time": r.create_time, "client_time": r.client_time, "phone": r.phone, "flow": r.flow, "attempt": r.attempt,
             "step": r.step, "level": r.level, "source": r.source, "data": r.data, "user_agent": r.user_agent}
            for r in rows.order_by("-create_time")[:300]
        ]})
