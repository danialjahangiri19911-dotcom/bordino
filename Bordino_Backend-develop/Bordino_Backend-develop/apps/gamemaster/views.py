"""Game Master API (/api/v1/gm/…): the creator's own games only (another creator's is «not found»)."""

from datetime import timedelta

from django.db.models import Count, Max, Q
from django.utils import timezone
from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from drf_spectacular.utils import extend_schema

from apps.gamemaster import budget, schema, services, starters
from apps.gamemaster.models import CreatorProfile, Game, GameAsset, GameVersion
from apps.missions import leaderboard as boards
from apps.missions import mystery as engine
from apps.missions import services as mission_services
from apps.missions.models import Mystery, MysteryCheckin, MysteryRun

TAGS = ["gamemaster"]


class GmThrottle(UserRateThrottle):
    scope = "gamemaster"
    rate = "120/min"


class GmUploadThrottle(UserRateThrottle):
    scope = "gamemaster_upload"
    rate = "20/min"


CODES = {"not_found": 404, "forbidden": 403, "closed": 403, "blocked": 403, "onboarding": 409, "payment_required": 402}


def _error(exc: services.GameMasterError):
    code = CODES.get(exc.code, 400 if exc.code in ("invalid", "incomplete") else 409)
    return Response({"error": exc.message, "code": exc.code, "fields": exc.errors}, status=code)


def profile_payload(user, p: CreatorProfile | None) -> dict:
    return {
        "available": services.can_use(user),
        "exists": p is not None,
        "onboarded": bool(p and p.onboarded),
        "preferred_mode": p.preferred_mode if p else CreatorProfile.Mode.PLAYER,
        "intent": p.intent if p else "",
        "business_name": p.business_name if p else "",
        "business_phone": p.business_phone if p else "",
        "blocked": bool(p and p.is_blocked),
        "terms_version": services.TERMS_VERSION,
    }


def version_payload(v: GameVersion | None) -> dict | None:
    if v is None:
        return None
    return {
        "id": str(v.pk),
        "number": v.number,
        "status": v.status,
        "submitted_at": v.submitted_at.isoformat(),
        "reviewed_at": v.reviewed_at.isoformat() if v.reviewed_at else None,
        "review_note": v.review_note,
        "fee_toman": v.fee_toman,
        "fee_paid": v.fee_paid,
        "published_at": v.published_at.isoformat() if v.published_at else None,
    }


def game_payload(game: Game, full: bool = False) -> dict:
    latest = game.versions.order_by("-number").first()
    body = {
        "id": str(game.pk),
        "title": game.title,
        "category": game.category,
        "template": game.template,
        "status": game.status,
        "paused_by_admin": game.paused_by_admin,
        "draft_saved_at": game.draft_saved_at.isoformat() if game.draft_saved_at else None,
        "create_time": game.create_time.isoformat(),
        "stages": len((game.draft or {}).get("stages") or []),
        "latest_version": version_payload(latest),
        "live_version": version_payload(game.live_version),
        "mystery_id": str(game.live_version.mystery.pk) if game.live_version and getattr(game.live_version, "mystery", None) else None,
        "edition": game.edition,
        "leaderboard": (game.draft or {}).get("leaderboard", {}).get("preset", "none"),
        **lifetime(game),
    }
    if full:
        draft = schema.clean(game.draft or {})
        body["draft"] = draft
        body["problems"] = services.problems(game, draft)
        body["next_publish"] = next_publish(game)
        body["max_run_points"] = schema.max_run_points(draft)
        live = game.live_version
        if live is not None and getattr(live, "mystery", None) is not None:
            body["budget"] = budget.summary(live)
        body["share"] = services.share(game)
        if body["share"]["kind"] == "invite":
            body["invite_url"] = body["share"]["url"]
    return body


def lifetime(game: Game) -> dict:
    """The live edition's dates and players (for the dashboard): when it ends, how long is left,
    and how many enrolled, are playing, finished."""
    live = game.live_version
    mystery = getattr(live, "mystery", None) if live else None
    if mystery is None:
        return {"expires_at": None, "grace_ends_at": None, "days_left": None, "players": 0, "active": 0, "finished": 0, "board_final": False}
    now = timezone.now()
    runs = MysteryRun.objects.filter(mystery__in=boards.scope_mysteries(mystery))
    counts = runs.aggregate(
        players=Count("customer", distinct=True),
        finished=Count("customer", distinct=True, filter=Q(status=MysteryRun.Status.COMPLETED)),
    )
    active = (
        runs.filter(status=MysteryRun.Status.ACTIVE)
        .annotate(last=Max("checkins__create_time"))
        .filter(Q(last__gte=now - timedelta(days=7)) | Q(last__isnull=True, create_time__gte=now - timedelta(days=7)))
        .count()
    )
    left = (mystery.ends_at - now).total_seconds() / 86400 if mystery.ends_at else None
    return {
        "expires_at": mystery.ends_at.isoformat() if mystery.ends_at else None,
        "grace_ends_at": mystery.grace_ends_at.isoformat() if mystery.grace_ends_at else None,
        "days_left": max(0, int(left + 0.999)) if left is not None else None,
        "players": counts["players"],
        "active": active,
        "finished": counts["finished"],
        "board_final": boards.snapshot_of(mystery) is not None,
    }


def next_publish(game: Game) -> str:
    """What publishing the approved version would do: "first" (the first edition), "continue" (the
    same edition, its players and board go on; or "new" if chosen), or "new_only" (the edition is over
    for good: a new edition)."""
    live = game.live_version
    mystery = getattr(live, "mystery", None) if live else None
    if mystery is None:
        return "first"
    if game.status == Game.Status.EXPIRED:
        end = boards.ended_at(mystery)
        if boards.snapshot_of(mystery) is not None or (end and end <= timezone.now()):
            return "new_only"
    return "continue"


class OptionsView(APIView):
    """What the editor offers: the leaderboard presets (with their defaults), metrics and limits."""

    permission_classes = (IsAuthenticated,)

    @extend_schema(tags=TAGS, summary="Leaderboard presets and availability limits")
    def get(self, request):
        categories = {c: services.leaderboard_allowed(c) for c in Game.Category.values}
        return Response(
            {
                "leaderboard": {
                    "presets": {k: {**boards.preset_config(k), "name": v["name"]} for k, v in boards.PRESETS.items()},
                    "metrics": boards.METRICS,
                    "unsupported_metrics": boards.UNSUPPORTED_METRICS,
                    "periods": list(boards.PERIODS),
                    "future_periods": list(boards.FUTURE_PERIODS),
                    "tops": list(boards.TOPS),
                    "teams": False,
                    "categories": categories,
                },
                "availability": {
                    "max_days": {c: int(services.setting(f"GM_MAX_DAYS_{c.upper()}") or 0) for c in Game.Category.values},
                    "max_grace_hours": int(services.setting("GM_MAX_GRACE_HOURS") or 0),
                    "zone": "Asia/Tehran",
                },
            }
        )


class GameBoardView(APIView):
    """My game's leaderboard as I (its creator) see it: every row, names masked unless a player
    chose to show theirs."""

    permission_classes = (IsAuthenticated,)

    @extend_schema(tags=TAGS, summary="Leaderboard of my game")
    def get(self, request, game_id):
        try:
            game = services.owned(request.user, game_id)
        except services.GameMasterError as exc:
            return _error(exc)
        live = game.live_version
        mystery = getattr(live, "mystery", None) if live else None
        if mystery is None:
            return Response({"board": None})
        return Response({"board": boards.board(mystery, None, _int(request.query_params.get("offset")), 50, staff=True, request=request)})


def _int(value) -> int:
    try:
        return max(0, int(value))
    except (TypeError, ValueError):
        return 0


class ProfileView(APIView):
    """The creator side of the signed-in user: mode, onboarding, business details."""

    permission_classes = (IsAuthenticated,)
    throttle_classes = (GmThrottle,)

    @extend_schema(tags=TAGS, summary="Game Master profile and app mode")
    def get(self, request):
        return Response({"profile": profile_payload(request.user, services.profile(request.user))})

    @extend_schema(tags=TAGS, summary="Update app mode / onboarding")
    def patch(self, request):
        try:
            p = services.update_profile(request.user, request.data if isinstance(request.data, dict) else {})
        except services.GameMasterError as exc:
            return _error(exc)
        return Response({"profile": profile_payload(request.user, p)})


class TemplatesView(APIView):
    permission_classes = (IsAuthenticated,)

    @extend_schema(tags=TAGS, summary="Starting templates")
    def get(self, request):
        return Response({"templates": starters.listing()})


class GamesView(APIView):
    permission_classes = (IsAuthenticated,)
    throttle_classes = (GmThrottle,)

    @extend_schema(tags=TAGS, summary="My games")
    def get(self, request):
        try:
            p = services.creator(request.user)
        except services.GameMasterError as exc:
            return _error(exc)
        for game in Game.objects.filter(owner=p, status__in=services.PLAYED):
            services.settle(game)
        games = Game.objects.filter(owner=p).select_related("live_version").order_by("-update_time")
        counts = dict(Game.objects.filter(owner=p).values_list("status").annotate(n=Count("id")).values_list("status", "n"))
        return Response({"games": [game_payload(g) for g in games], "counts": counts})

    @extend_schema(tags=TAGS, summary="Create a game (from a template)")
    def post(self, request):
        data = request.data if isinstance(request.data, dict) else {}
        try:
            game = services.create_game(request.user, str(data.get("category") or ""), data.get("template") or None, str(data.get("title") or ""))
        except services.GameMasterError as exc:
            return _error(exc)
        return Response({"game": game_payload(game, full=True)}, status=status.HTTP_201_CREATED)


class GameView(APIView):
    permission_classes = (IsAuthenticated,)
    throttle_classes = (GmThrottle,)

    @extend_schema(tags=TAGS, summary="One of my games, with its draft")
    def get(self, request, game_id):
        try:
            game = services.settle(services.owned(request.user, game_id))
        except services.GameMasterError as exc:
            return _error(exc)
        return Response({"game": game_payload(game, full=True)})

    @extend_schema(tags=TAGS, summary="Autosave the draft")
    def patch(self, request, game_id):
        data = request.data if isinstance(request.data, dict) else {}
        try:
            game = services.save_draft(request.user, game_id, data.get("draft"))
        except services.GameMasterError as exc:
            return _error(exc)
        return Response({"game": game_payload(game, full=True)})


ACTIONS = {
    "submit": lambda user, gid, data: services.submit(user, gid),
    "publish": lambda user, gid, data: services.publish(user, gid, new_edition=data.get("new_edition") is True),
    "pause": lambda user, gid, data: services.set_paused(user, gid, True),
    "resume": lambda user, gid, data: services.set_paused(user, gid, False),
    "archive": lambda user, gid, data: services.archive(user, gid),
    "duplicate": lambda user, gid, data: services.duplicate(user, gid),
}


class GameActionView(APIView):
    """submit / publish / pause / resume / archive / duplicate."""

    permission_classes = (IsAuthenticated,)
    throttle_classes = (GmThrottle,)

    @extend_schema(tags=TAGS, summary="A game action")
    def post(self, request, game_id, action):
        handler = ACTIONS.get(action)
        if handler is None:
            return Response({"error": "کار نامعتبر است."}, status=404)
        try:
            result = handler(request.user, game_id, request.data if isinstance(request.data, dict) else {})
            game = result if isinstance(result, Game) else Game.objects.get(pk=result.game_id) if isinstance(result, GameVersion) else None
            game = services.owned(request.user, game.pk) if game else None
        except services.GameMasterError as exc:
            return _error(exc)
        return Response({"game": game_payload(game, full=True) if game else None})


class PreviewView(APIView):
    """Checks one stage of the draft (nothing recorded, nothing paid)."""

    permission_classes = (IsAuthenticated,)
    throttle_classes = (GmThrottle,)

    @extend_schema(tags=TAGS, summary="Preview: check a stage of the draft")
    def post(self, request, game_id):
        data = request.data if isinstance(request.data, dict) else {}
        try:
            result = services.preview(request.user, game_id, str(data.get("stage") or ""), data)
        except services.GameMasterError as exc:
            return _error(exc)
        return Response({"ok": result.ok, "message": result.message, "points": result.points, "coupon": result.coupon})


class QrView(APIView):
    """The live game's QR stages: the address to print (or the venue screen) for each."""

    permission_classes = (IsAuthenticated,)

    @extend_schema(tags=TAGS, summary="QR codes of my published game")
    def get(self, request, game_id):
        import segno  # pylint: disable=import-outside-toplevel

        try:
            game = services.owned(request.user, game_id)
        except services.GameMasterError as exc:
            return _error(exc)
        live = game.live_version
        mystery = getattr(live, "mystery", None) if live else None
        if mystery is None:
            return Response({"qr": []})
        base = services.public_base()
        items = []
        for step in engine.steps_of(mystery):
            if step.proof != step.Proof.QR or not step.qr_token:
                continue
            if step.qr_rotating:
                # A screen at the place shows a new code every 30 s (a photo of it stops working).
                items.append({"order": step.order, "place": step.place_name, "venue_url": f"{base}/venue/{step.qr_display_key}", "url": "", "svg": ""})
                continue
            url = f"{base}/pwa/earn/qr/{step.qr_token}"
            items.append({"order": step.order, "place": step.place_name, "url": url, "venue_url": "", "svg": segno.make(url, error="m").svg_inline(scale=6, border=2)})
        return Response({"qr": items})


class ShareView(APIView):
    """The game's link to share (a private game's invite, or a public game's page) and its QR."""

    permission_classes = (IsAuthenticated,)

    @extend_schema(tags=TAGS, summary="The game's share link and its QR")
    def get(self, request, game_id):
        import segno  # pylint: disable=import-outside-toplevel

        try:
            game = services.owned(request.user, game_id)
        except services.GameMasterError as exc:
            return _error(exc)
        info = services.share(game)
        svg = segno.make(info["url"], error="m").svg_inline(scale=8, border=2) if info["url"] else ""
        return Response({**info, "svg": svg})


def audience_numbers(mystery: Mystery) -> dict:
    """This edition's players, counted separately (never one for another): enrolled (joined), started
    (solved at least one stage), active (moved in the last 7 days and not done), completed; and
    the stage proofs, verified visits and rewards claimed. Aggregates only: no player is named."""
    now = timezone.now()
    scope = boards.scope_mysteries(mystery)
    runs = MysteryRun.objects.filter(mystery__in=scope).annotate(done=Count("checkins", distinct=True), last=Max("checkins__create_time"))
    enrolled = started = active = completed = 0
    progress = 0.0
    totals = dict(scope.annotate(n=Count("steps", distinct=True)).values_list("pk", "n"))
    for run in runs.only("id", "status", "mystery_id", "create_time"):
        enrolled += 1
        total = totals.get(run.mystery_id) or 0
        progress += (run.done / total) if total else 0
        if run.done:
            started += 1
        if run.status == MysteryRun.Status.COMPLETED:
            completed += 1
        elif (run.last or run.create_time) >= now - timedelta(days=7):
            active += 1
    checkins = MysteryCheckin.objects.filter(step__mystery__in=scope)
    return {
        "enrolled": enrolled,
        "started_playing": started,
        "active": active,
        "completed_players": completed,
        "completion_rate": round(100 * completed / enrolled) if enrolled else 0,
        "average_progress": round(100 * progress / enrolled) if enrolled else 0,
        "stage_completions": checkins.count(),
        "verified_visits": checkins.filter(step__proof="qr", step__qr_rotating=True).count(),
        "reward_claims": checkins.exclude(step__coupon_text="").count(),
        "edition": mystery.edition,
    }


class AnalyticsView(APIView):
    """My game's numbers: players, finishes, visits per stage, budget (aggregated; no player data)."""

    permission_classes = (IsAuthenticated,)

    @extend_schema(tags=TAGS, summary="Analytics of my game")
    def get(self, request, game_id):
        try:
            game = services.owned(request.user, game_id)
        except services.GameMasterError as exc:
            return _error(exc)
        live = game.live_version
        mystery = getattr(live, "mystery", None) if live else None
        if mystery is None:
            return Response({"analytics": None})
        r = engine.report(mystery)
        people = audience_numbers(mystery)
        reached = [row["total"] for row in r["steps"]]
        return Response(
            {
                "analytics": {
                    **people,
                    # (kept for the older app: this version's own numbers)
                    "started": r["started"],
                    "completed": r["completed"],
                    "drop_off": [
                        round(100 * (1 - n / prev)) if prev else 0
                        for prev, n in zip([people["enrolled"]] + reached[:-1], reached)
                    ],
                    "leaderboard": (mystery.leaderboard or {}).get("preset", "none"),
                    "days": [d.isoformat() for d in r["days"]],
                    "stages": [
                        {
                            "order": row["step"].order,
                            "place": row["step"].place_name,
                            "proof": row["step"].proof,
                            # Only the venue screen's changing QR proves the player was there; a printed QR
                            # can be photographed and shared, a location or an answer proves nothing.
                            "verified_visit": row["step"].proof == row["step"].Proof.QR and row["step"].qr_rotating,
                            "qr_printed": row["step"].proof == row["step"].Proof.QR and not row["step"].qr_rotating,
                            "total": row["total"],
                            "week": row["week"],
                            "hints": row["hints"],
                            "daily": row["daily"],
                        }
                        for row in r["steps"]
                    ],
                    "budget": budget.summary(live),
                }
            }
        )


class UploadView(APIView):
    """An image for a game (a real JPEG/PNG/WEBP, ≤5 MB): returns its stored name."""

    permission_classes = (IsAuthenticated,)
    throttle_classes = (GmUploadThrottle,)
    parser_classes = (MultiPartParser, FormParser, JSONParser)

    @extend_schema(tags=TAGS, summary="Upload a game image")
    def post(self, request):
        image = request.FILES.get("image")
        try:
            p = services.creator(request.user)
            if not image:
                raise services.GameMasterError("تصویری فرستاده نشد.")
            services.check_upload_quota(p)
            mission_services._check_image(image)  # pylint: disable=protected-access
        except services.GameMasterError as exc:
            return _error(exc)
        except mission_services.MissionError as exc:
            return Response({"error": exc.message, "code": "invalid"}, status=400)
        asset = GameAsset.objects.create(owner=p, image=image)
        return Response({"name": asset.image.name, "url": asset.image.url}, status=status.HTTP_201_CREATED)


class DashboardView(APIView):
    """Counts for the Game Master home: games by status, players and finishes across my live games."""

    permission_classes = (IsAuthenticated,)

    @extend_schema(tags=TAGS, summary="Game Master dashboard")
    def get(self, request):
        try:
            p = services.creator(request.user)
        except services.GameMasterError as exc:
            return _error(exc)
        from apps.missions.models import MysteryRun  # pylint: disable=import-outside-toplevel

        games = Game.objects.filter(owner=p)
        by_status = dict(games.values_list("status").annotate(n=Count("id")).values_list("status", "n"))
        runs = MysteryRun.objects.filter(mystery__source_version__game__owner=p)
        totals = runs.aggregate(started=Count("id"), completed=Count("id", filter=Q(status=MysteryRun.Status.COMPLETED)))
        return Response({"by_status": by_status, "players": totals["started"], "completed": totals["completed"]})


class PayView(APIView):
    """The approved version's publication fee: starts a Zibal payment and says where to pay it."""

    permission_classes = (IsAuthenticated,)
    throttle_classes = (GmThrottle,)

    @extend_schema(tags=TAGS, summary="Pay the publication fee (Zibal)")
    def post(self, request, game_id):
        try:
            payment, url = services.start_payment(request.user, game_id)
        except services.GameMasterError as exc:
            return _error(exc)
        return Response({"payment_url": url, "track_id": payment.track_id, "amount_toman": payment.amount_toman, "mode": payment.mode})


class PayVerifyView(APIView):
    """Back from Zibal (or the sandbox page): confirms the payment once; another user's is «not found»."""

    permission_classes = (IsAuthenticated,)
    throttle_classes = (GmThrottle,)

    @extend_schema(tags=TAGS, summary="Confirm a Zibal payment")
    def post(self, request):
        data = request.data if isinstance(request.data, dict) else {}
        success = str(data.get("success", "")).lower() in ("1", "true")
        try:
            payment = services.confirm_payment(request.user, str(data.get("trackId") or ""), success)
        except services.GameMasterError as exc:
            return _error(exc)
        return Response({"status": payment.status, "game_id": str(payment.game_id), "ref_number": payment.ref_number, "amount_toman": payment.amount_toman, "mode": payment.mode})
