"""Game Master API (/api/v1/gm/…): the creator's own games only (another creator's is «not found»)."""

from django.db.models import Count, Q
from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from drf_spectacular.utils import extend_schema

from apps.gamemaster import budget, schema, services, starters
from apps.gamemaster.models import CreatorProfile, Game, GameAsset, GameVersion
from apps.missions import mystery as engine
from apps.missions import services as mission_services

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
    }
    if full:
        draft = schema.clean(game.draft or {})
        body["draft"] = draft
        body["problems"] = schema.check(draft)
        body["max_run_points"] = schema.max_run_points(draft)
        live = game.live_version
        if live is not None and getattr(live, "mystery", None) is not None:
            body["budget"] = budget.summary(live)
            if live.mystery.access == live.mystery.Access.PRIVATE:
                body["invite_url"] = f"{services.public_base()}/pwa/play/{live.mystery.invite_token}"
    return body


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
            game = services.owned(request.user, game_id)
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
    "publish": lambda user, gid, data: services.publish(user, gid),
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
            url = f"{base}/pwa/earn/qr/{step.qr_token}"
            items.append({"order": step.order, "place": step.place_name, "url": url, "svg": segno.make(url, error="m").svg_inline(scale=6, border=2)})
        return Response({"qr": items})


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
        return Response(
            {
                "analytics": {
                    "started": r["started"],
                    "completed": r["completed"],
                    "days": [d.isoformat() for d in r["days"]],
                    "stages": [
                        {
                            "order": row["step"].order,
                            "place": row["step"].place_name,
                            "proof": row["step"].proof,
                            # A QR scanned at the place is a verified visit; a location or an answer is not proof of one.
                            "verified_visit": row["step"].proof == row["step"].Proof.QR,
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
