from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle
from rest_framework.views import APIView

from drf_spectacular.utils import extend_schema

from apps.missions import services
from apps.missions.models import Mission, MissionAttempt, MissionCategory
from apps.wallet.services import ad_reward
from apps.wallet.services.balance import points_account


class MissionThrottle(UserRateThrottle):
    scope = "missions"
    rate = "60/min"


class CallbackThrottle(AnonRateThrottle):
    scope = "missions_callback"
    rate = "120/min"


ERROR_STATUS = {"not_found": status.HTTP_404_NOT_FOUND, "forbidden": status.HTTP_403_FORBIDDEN}


def _error(exc: services.MissionError):
    code = ERROR_STATUS.get(exc.code, status.HTTP_409_CONFLICT if exc.code != "invalid" else status.HTTP_400_BAD_REQUEST)
    return Response({"error": exc.message, "code": exc.code}, status=code)


def _customer(request):
    customer = getattr(request.user, "customer", None)
    if customer is None:
        raise services.MissionError("حساب بازیکن پیدا نشد.")
    return customer


def _balance(request):
    account = points_account(request.user)
    return int(account.amount) if account else None


def attempt_payload(attempt: MissionAttempt | None) -> dict | None:
    if attempt is None:
        return None
    mission = attempt.mission
    body = {
        "id": str(attempt.pk),
        "status": attempt.status,
        "points": attempt.points,
        "started_at": attempt.create_time.isoformat(),
        "review_note": attempt.review_note if attempt.status == MissionAttempt.Status.REJECTED else "",
    }
    if attempt.status == MissionAttempt.Status.STARTED:
        if mission.link_url:
            body["link"] = services.link_for(attempt)
        if mission.kind == Mission.Kind.BANNER:
            body["opened"] = attempt.opened_at is not None
            if attempt.opened_at:
                wait = mission.min_seconds - (timezone.now() - attempt.opened_at).total_seconds()
                body["claim_in"] = max(0, int(wait + 0.999))
            else:
                body["claim_in"] = mission.min_seconds
        if attempt.ad_session_id and mission.kind == Mission.Kind.VIDEO:
            session = attempt.ad_session
            body["ad"] = {
                "session_id": str(session.pk),
                "reward_points": session.reward_points,
                "min_watch_seconds": session.min_watch_seconds,
                "provider": session.provider,
                "creative": ad_reward.PROVIDERS[session.provider].creative() if session.provider in ad_reward.PROVIDERS else {},
            }
    return body


def mission_payload(view: services.View) -> dict:
    m = view.mission
    return {
        "id": str(m.pk),
        "title": m.title,
        "summary": m.summary,
        "description": m.description,
        "category": str(m.category_id),
        "kind": m.kind,
        "verification": m.verification,
        "points": m.points,
        "repeat": m.repeat,
        "limit": view.limit,
        "used": view.used,
        "partner_name": m.partner_name,
        "image": m.image.url if m.image else None,
        "proof_label": m.proof_label,
        "proof_image_required": m.proof_image_required,
        "min_seconds": m.min_seconds,
        "starts_at": m.starts_at.isoformat() if m.starts_at else None,
        "ends_at": m.ends_at.isoformat() if m.ends_at else None,
        "order": m.order,
        "create_time": m.create_time.isoformat(),
        "state": view.state,
        "attempt": attempt_payload(view.attempt),
    }


def _one(customer, mission_id) -> dict | None:
    for view in services.listing(customer):
        if str(view.mission.pk) == str(mission_id):
            return mission_payload(view)
    return None


class MissionListView(APIView):
    """The missions and their categories, each mission with its state for this player."""

    permission_classes = (IsAuthenticated,)

    @extend_schema(tags=["missions"], summary="Missions to earn points")
    def get(self, request):
        try:
            customer = _customer(request)
        except services.MissionError as exc:
            return _error(exc)
        views = services.listing(customer)
        used = {v.mission.category_id for v in views}
        categories = [
            {"id": str(c.pk), "name": c.name, "icon": c.icon}
            for c in MissionCategory.objects.filter(is_active=True, pk__in=used)
        ]
        return Response({"categories": categories, "missions": [mission_payload(v) for v in views]})


class MissionStartView(APIView):
    permission_classes = (IsAuthenticated,)
    throttle_classes = (MissionThrottle,)

    @extend_schema(tags=["missions"], summary="Start (or continue) a mission")
    def post(self, request, mission_id):
        try:
            customer = _customer(request)
            services.start(customer, mission_id)
        except services.MissionError as exc:
            return _error(exc)
        return Response({"mission": _one(customer, mission_id)}, status=status.HTTP_201_CREATED)


class MissionClaimView(APIView):
    """The reward of a watched video or an opened banner. Repeating it pays nothing more."""

    permission_classes = (IsAuthenticated,)
    throttle_classes = (MissionThrottle,)

    @extend_schema(tags=["missions"], summary="Claim a video or banner mission")
    def post(self, request, attempt_id):
        try:
            customer = _customer(request)
            result = services.claim(customer, attempt_id, request.data if isinstance(request.data, dict) else {})
        except services.MissionError as exc:
            return _error(exc)
        return Response(
            {
                "rewarded": True,
                "already_rewarded": result.already,
                "points": result.attempt.points,
                "points_balance": _balance(request),
                "mission": _one(customer, result.attempt.mission_id),
            }
        )


class MissionOpenedView(APIView):
    """The player opened the try's link (a banner's wait starts here)."""

    permission_classes = (IsAuthenticated,)
    throttle_classes = (MissionThrottle,)

    @extend_schema(tags=["missions"], summary="The mission's link was opened")
    def post(self, request, attempt_id):
        try:
            customer = _customer(request)
            attempt = services.mark_opened(customer, attempt_id)
        except services.MissionError as exc:
            return _error(exc)
        return Response({"mission": _one(customer, attempt.mission_id)})


class ProofSerializer(serializers.Serializer):
    text = serializers.CharField(max_length=200, required=False, allow_blank=True)
    image = serializers.FileField(required=False, allow_null=True)


class MissionProofView(APIView):
    """Sends the proof of a sign-up / install for review."""

    permission_classes = (IsAuthenticated,)
    throttle_classes = (MissionThrottle,)
    parser_classes = (MultiPartParser, FormParser, JSONParser)

    @extend_schema(tags=["missions"], summary="Send a mission's proof for review", request=ProofSerializer)
    def post(self, request, attempt_id):
        data = ProofSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        try:
            customer = _customer(request)
            attempt = services.submit_proof(
                customer, attempt_id, data.validated_data.get("text", ""), data.validated_data.get("image")
            )
        except services.MissionError as exc:
            return _error(exc)
        return Response({"mission": _one(customer, attempt.mission_id)})


class MissionQrView(APIView):
    """A place's QR: its link opens the app, which sends the code here."""

    permission_classes = (IsAuthenticated,)
    throttle_classes = (MissionThrottle,)

    @extend_schema(tags=["missions"], summary="Claim a QR mission")
    def post(self, request, token):
        try:
            customer = _customer(request)
            result = services.claim_qr(customer, token)
        except services.MissionError as exc:
            return _error(exc)
        mission = result.attempt.mission
        return Response(
            {
                "rewarded": True,
                "already_rewarded": result.already,
                "points": result.attempt.points,
                "points_balance": _balance(request),
                "title": mission.title,
                "summary": mission.summary,
            }
        )


class MissionCallbackView(APIView):
    """The partner's server: GET or POST with click_id and secret (query string or body)."""

    authentication_classes = ()
    permission_classes = (AllowAny,)
    throttle_classes = (CallbackThrottle,)

    def _handle(self, request, mission_id):
        params = {**request.query_params.dict(), **(request.data if isinstance(request.data, dict) else {})}
        try:
            result = services.partner_callback(mission_id, params.get("click_id"), params.get("secret", ""))
        except services.MissionError as exc:
            return _error(exc)
        return Response({"ok": True, "already": result.already})

    @extend_schema(tags=["missions"], summary="Partner confirms a sign-up / install")
    def get(self, request, mission_id):
        return self._handle(request, mission_id)

    @extend_schema(tags=["missions"], summary="Partner confirms a sign-up / install")
    def post(self, request, mission_id):
        return self._handle(request, mission_id)
