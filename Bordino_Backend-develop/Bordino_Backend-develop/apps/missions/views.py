from django.conf import settings
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle
from rest_framework.views import APIView

from drf_spectacular.utils import extend_schema

from apps.missions import leaderboard as boards
from apps.missions import mystery, services
from apps.missions.models import Mission, MissionAttempt, MissionCategory, MysteryRun, MysteryStep
from apps.wallet.services import ad_reward
from apps.wallet.services.balance import points_account


class MissionThrottle(UserRateThrottle):
    scope = "missions"
    rate = "60/min"


class CallbackThrottle(AnonRateThrottle):
    scope = "missions_callback"
    rate = "120/min"


class VenueThrottle(AnonRateThrottle):
    # A venue screen asks once per code (every 30 s). Its own budget: guests scanning on the same
    # Wi-Fi (one address) never use it up.
    scope = "missions_venue"
    rate = "30/min"


class QrHoldThrottle(AnonRateThrottle):
    # A scan while signed out asks once; a full room on one Wi-Fi address may scan together.
    scope = "missions_qr_hold"
    rate = "120/min"


ERROR_STATUS = {"not_found": status.HTTP_404_NOT_FOUND, "forbidden": status.HTTP_403_FORBIDDEN, "qr_expired": status.HTTP_410_GONE}


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
        if mission.kind in (Mission.Kind.BANNER, Mission.Kind.INTERSTITIAL):
            body["opened"] = attempt.opened_at is not None
            if attempt.opened_at:
                wait = mission.min_seconds - (timezone.now() - attempt.opened_at).total_seconds()
                body["claim_in"] = max(0, int(wait + 0.999))
            else:
                body["claim_in"] = mission.min_seconds
        if mission.kind == Mission.Kind.INTERSTITIAL:
            # The full-screen ad the app shows; «opened» is sent when it is shown.
            body["ad"] = {"provider": "adivery", "format": "interstitial", "creative": ad_reward.interstitial_creative() or {}}
        if attempt.ad_session_id and mission.kind == Mission.Kind.VIDEO:
            session = attempt.ad_session
            body["ad"] = {
                "session_id": str(session.pk),
                "reward_points": session.reward_points,
                "min_watch_seconds": session.min_watch_seconds,
                "provider": session.provider,
                "creative": ad_reward.PROVIDERS[session.provider].creative(session.customer) if session.provider in ad_reward.PROVIDERS else {},
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
        "pending": view.pending,
        "completed": view.completed,
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
        return Response(
            {
                "categories": categories,
                "missions": [mission_payload(v) for v in views],
                "mysteries": [mystery_card(v) for v in mystery.listing(customer)],
            }
        )


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
        if isinstance(result, mystery.Result):
            return Response(
                {
                    "rewarded": True,
                    "already_rewarded": result.already,
                    "points": result.points + result.bonus,
                    "points_balance": _balance(request),
                    "title": result.step.place_name,
                    "summary": result.run.mystery.title,
                    "mystery": {"id": str(result.run.mystery_id), "finished": result.finished, "bonus": result.bonus},
                }
            )
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


class MissionQrHoldView(APIView):
    """A venue screen's code scanned while signed out: kept valid through the sign-in (a hold)."""

    permission_classes = (AllowAny,)
    authentication_classes = ()
    throttle_classes = (QrHoldThrottle,)

    @extend_schema(tags=["missions"], summary="Keep a venue QR code through sign-in")
    def post(self, request, token):
        try:
            return Response({"code": services.hold_qr(token)})
        except services.MissionError as exc:
            return _error(exc)


class VenueDisplayView(APIView):
    """The venue screen (/venue/<key>): the code to show now, as a QR image, and when it changes."""

    permission_classes = (AllowAny,)
    authentication_classes = ()
    throttle_classes = (VenueThrottle,)

    @extend_schema(tags=["missions"], summary="The venue screen's current QR")
    def get(self, request, key):
        import segno  # pylint: disable=import-outside-toplevel

        try:
            mission, code, expires_in, valid_for = services.venue_display(key)
        except services.MissionError as exc:
            return _error(exc)
        url = f"{settings.MISSIONS_PUBLIC_URL.rstrip('/')}/pwa/earn/qr/{code}"
        svg = segno.make(url, error="m").svg_inline(scale=8, border=2)
        if isinstance(mission, MysteryStep):
            # A mystery step's screen: the place's name (the players are there already).
            title, points, active = mission.place_name, mission.points, mission.mystery.is_active
        else:
            title, points, active = mission.title, mission.points, mission.is_active
        response = Response(
            {
                "title": title,
                "points": points,
                "active": active,
                "url": url,
                "svg": svg,
                "expires_in": expires_in,
                "valid_for": valid_for,
                "step": services.QR_STEP,
            }
        )
        response["Cache-Control"] = "no-store"
        return response


# ── «معمای شهری» ──


def _media(field) -> str | None:
    return field.url if field else None


def _when(value):
    return value.isoformat() if value else None


def mystery_card(view: mystery.View) -> dict:
    m = view.mystery
    return {
        "id": str(m.pk),
        "title": m.title,
        "summary": m.summary,
        "cover": _media(m.cover),
        "area": m.area,
        "duration_minutes": m.duration_minutes,
        "steps": view.steps,
        "done": view.done,
        "points": view.points,
        "finish_points": m.finish_points,
        "starts_at": _when(m.starts_at),
        "ends_at": _when(m.ends_at),
        "order": m.order,
        "state": view.state,
        # A creator's game (Game Master): who presents it.
        "creator": m.is_creator_game,
        "presenter": m.presenter,
        "has_leaderboard": boards.enabled(m.leaderboard),
    }


def _place(step: MysteryStep) -> dict:
    return {
        "name": step.place_name,
        "logo": _media(step.place_logo),
        "address": step.place_address,
        "about": step.place_about,
        "offer": step.place_offer,
        "url": step.place_url,
        "map": step.map_link(),
        "is_place": step.is_place,
        "coupon": step.coupon_text,
    }


def mystery_detail(view: mystery.View) -> dict:
    """The mystery and this player's steps: the solved ones with their place, the current one's clue
    and how it is proved, the later ones locked. Never a place's position, answer, code or QR."""
    m, run = view.mystery, view.run
    body = mystery_card(view)
    body["story"] = m.story
    body["completion_message"] = m.completion_message if run and run.status == run.Status.COMPLETED else ""
    steps = mystery.steps_of(m)
    visits = {c.step_id: c for c in run.checkins.all()} if run else {}
    current = mystery.current_step(steps, set(visits)) if run and run.status == run.Status.ACTIVE else None
    now = timezone.now()
    body["run"] = (
        {
            "status": run.status,
            "started_at": run.create_time.isoformat(),
            "completed_at": _when(run.completed_at),
            "points_earned": run.points_earned,
            "locked_in": max(0, int((run.locked_until - now).total_seconds() + 0.999)) if run.locked_until and run.locked_until > now else 0,
        }
        if run
        else None
    )
    shown = []
    for number, step in enumerate(steps, 1):
        item = {"id": str(step.pk), "number": number, "points": step.points}
        if step.pk in visits:
            item.update(state="done", clue=step.clue, place=_place(step), visited_at=visits[step.pk].create_time.isoformat())
        elif current is not None and step.pk == current.pk:
            help_now = mystery.hint_view(step, m, run.hints_used)
            if step.proof == MysteryStep.Proof.CHOICE and (run.wrong_tries or run.locked_until):
                help_now.update(points_now=0, next_hint_cost=0)  # a wrong pick: nothing left to win here
            limit_left = None
            if step.time_limit_s and run.step_started_at:
                limit_left = max(0, int(step.time_limit_s - (now - run.step_started_at).total_seconds()))
            item.update(
                state="current",
                clue=step.clue,
                clue_image=_media(step.clue_image),
                answer_type=step.answer_type if step.proof == MysteryStep.Proof.ANSWER else "text",
                **help_now,
                proof=step.proof,
                options=list(step.options or []) if step.proof == MysteryStep.Proof.CHOICE else [],
                time_limit_s=step.time_limit_s,
                time_left_s=limit_left,
                question=step.question if step.proof in (MysteryStep.Proof.ANSWER, MysteryStep.Proof.CHOICE) else "",
                check_location=step.proof == MysteryStep.Proof.GPS or step.check_location,
                radius_m=step.radius_m,
            )
        else:
            item.update(state="locked")
        shown.append(item)
    body["step_list"] = shown
    # The leaderboard's rules are shown before joining; the board itself to whom its rules allow.
    cfg = boards.clean(boards.current_mystery(m).leaderboard)
    if boards.enabled(cfg):
        ok, _cap, why = boards.access(m, run.customer if run else None)
        body["leaderboard"] = {
            "enabled": True, "visible": ok, "reason": why, "name": boards.PRESETS[cfg["preset"]]["name"],
            "rules": boards.describe(cfg), "show_identity": bool(run and run.show_identity),
        }
    else:
        body["leaderboard"] = {"enabled": False}
    body["grace_ends_at"] = _when(m.grace_ends_at)
    body["in_grace"] = mystery.in_grace(m)
    return body


class MysteryDetailView(APIView):
    permission_classes = (IsAuthenticated,)

    @extend_schema(tags=["missions"], summary="A city mystery and this player's progress")
    def get(self, request, mystery_id):
        try:
            customer = _customer(request)
            view = mystery.view_of(customer, mystery_id)
        except services.MissionError as exc:
            return _error(exc)
        return Response({"mystery": mystery_detail(view)})


class MysteryStartView(APIView):
    permission_classes = (IsAuthenticated,)
    throttle_classes = (MissionThrottle,)

    @extend_schema(tags=["missions"], summary="Start a city mystery")
    def post(self, request, mystery_id):
        try:
            customer = _customer(request)
            mystery.start(customer, mystery_id)
            view = mystery.view_of(customer, mystery_id)
        except services.MissionError as exc:
            return _error(exc)
        return Response({"mystery": mystery_detail(view)}, status=status.HTTP_201_CREATED)


class MysteryHintView(APIView):
    """Opens the current step's next help level (a nudge, more, the place, the answer); it lowers
    the step's points."""

    permission_classes = (IsAuthenticated,)
    throttle_classes = (MissionThrottle,)

    @extend_schema(tags=["missions"], summary="Open the next hint of a city mystery step")
    def post(self, request, mystery_id, step_id):
        try:
            customer = _customer(request)
            mystery.reveal_hint(customer, mystery_id, step_id)
            view = mystery.view_of(customer, mystery_id)
        except services.MissionError as exc:
            return _error(exc)
        return Response({"mystery": mystery_detail(view)})


class MysteryInviteView(APIView):
    """A private game's invite link: joins the game (or reopens it) and returns it."""

    permission_classes = (IsAuthenticated,)
    throttle_classes = (MissionThrottle,)

    @extend_schema(tags=["missions"], summary="Join a private game by its invite")
    def post(self, request, token):
        try:
            customer = _customer(request)
            run = mystery.start_by_invite(customer, token)
            view = mystery.view_of(customer, run.mystery_id)
        except services.MissionError as exc:
            return _error(exc)
        return Response({"mystery": mystery_detail(view)})


class MysteryBoardView(APIView):
    """A game's leaderboard as this player may see it (a page of it, and their own row)."""

    permission_classes = (IsAuthenticated,)
    throttle_classes = (MissionThrottle,)

    @extend_schema(tags=["missions"], summary="Leaderboard of a city mystery / creator game")
    def get(self, request, mystery_id):
        try:
            customer = _customer(request)
            view = mystery.view_of(customer, mystery_id)  # (a game this player cannot see: not found)
        except services.MissionError as exc:
            return _error(exc)
        try:
            offset = max(0, int(request.query_params.get("offset") or 0))
            limit = max(1, min(50, int(request.query_params.get("limit") or 0) or 20))
        except ValueError:
            offset, limit = 0, 20
        owner = view.mystery.owner_id is not None and view.mystery.owner_id == customer.pk
        result = boards.board(view.mystery, customer, offset, limit, staff=owner, request=request)
        result["title"] = view.mystery.title
        return Response({"board": result})


class MysteryIdentityView(APIView):
    """The player shows (or hides) their name and picture on this game's leaderboard."""

    permission_classes = (IsAuthenticated,)
    throttle_classes = (MissionThrottle,)

    @extend_schema(tags=["missions"], summary="Show my name on this game's leaderboard")
    def post(self, request, mystery_id):
        try:
            customer = _customer(request)
            view = mystery.view_of(customer, mystery_id)
        except services.MissionError as exc:
            return _error(exc)
        if view.run is None:
            return _error(services.MissionError("اول بازی را شروع کن.", "not_started"))
        show = request.data.get("show") is True if isinstance(request.data, dict) else False
        MysteryRun.objects.filter(pk=view.run.pk, customer=customer).update(show_identity=show, update_time=timezone.now())
        return Response({"show_identity": show})


class CheckinSerializer(serializers.Serializer):
    answer = serializers.CharField(max_length=100, required=False, allow_blank=True)
    code = serializers.CharField(max_length=100, required=False, allow_blank=True)
    lat = serializers.FloatField(required=False, allow_null=True)
    lng = serializers.FloatField(required=False, allow_null=True)
    accuracy = serializers.FloatField(required=False, allow_null=True)


class MysteryCheckinView(APIView):
    """The current step proved by its answer, the staff's code or the phone's location (a QR step
    goes through the QR address instead)."""

    permission_classes = (IsAuthenticated,)
    throttle_classes = (MissionThrottle,)

    @extend_schema(tags=["missions"], summary="Prove a city mystery step", request=CheckinSerializer)
    def post(self, request, mystery_id, step_id):
        data = CheckinSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        try:
            customer = _customer(request)
            result = mystery.checkin(customer, mystery_id, step_id, data.validated_data)
            view = mystery.view_of(customer, mystery_id)
        except services.MissionError as exc:
            return _error(exc)
        return Response(
            {
                "rewarded": True,
                "already_rewarded": result.already,
                "points": result.points,
                "bonus": result.bonus,
                "finished": result.finished,
                "points_balance": _balance(request),
                "mystery": mystery_detail(view),
            }
        )
