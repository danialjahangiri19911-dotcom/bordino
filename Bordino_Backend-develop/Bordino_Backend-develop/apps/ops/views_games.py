"""«بردینو ادمین»: creator games — the review queue, a version as it will be played (answers shown to
staff), the decision, and the live games (pause, end, archive, a run off a leaderboard). Every rule
is Game Master's own (apps.gamemaster.services); this only shows and calls it."""

from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.gamemaster import schema, services
from apps.gamemaster.admin import STAGE_NAMES, availability_text, board_text
from apps.gamemaster.models import Game, GameAuditLog, GameReview, GameVersion
from apps.missions import leaderboard as boards
from apps.missions.models import MysteryRun
from apps.ops.auth import audit, role_permission
from apps.ops.views_auth import err

Reviewer = role_permission("reviewer")


def _creator(game: Game) -> dict:
    o = game.owner
    return {"name": o.business_name or (o.user.username or ""), "phone": "0" + o.user.phone_number}


def _version_row(v: GameVersion) -> dict:
    g = v.game
    return {
        "id": str(v.pk),
        "game_id": str(g.pk),
        "title": v.definition.get("title") or g.title,
        "number": v.number,
        "category": g.category,
        "category_name": g.get_category_display(),
        "status": v.status,
        "submitted_at": v.submitted_at.isoformat(),
        "waiting_hours": round((timezone.now() - v.submitted_at).total_seconds() / 3600, 1),
        "stages": len(v.definition.get("stages") or []),
        "creator": _creator(g),
        "extension": g.versions.filter(mystery__isnull=False).exclude(pk=v.pk).exists(),
    }


class QueueView(APIView):
    permission_classes = (Reviewer,)

    def get(self, request):
        status = request.query_params.get("status") or "submitted"
        qs = GameVersion.objects.select_related("game__owner__user")
        qs = qs.filter(status=status) if status != "all" else qs
        qs = qs.order_by("submitted_at" if status == "submitted" else "-submitted_at")[:100]
        counts = dict(GameVersion.objects.values_list("status").annotate(n=Count("id")).values_list("status", "n"))
        return Response({"versions": [_version_row(v) for v in qs], "counts": counts})


class VersionView(APIView):
    permission_classes = (Reviewer,)

    def get(self, request, version_id):
        v = GameVersion.objects.select_related("game__owner__user", "reviewer").filter(pk=version_id).first()
        if v is None:
            return err("پیدا نشد.", "not_found", 404)
        d = schema.clean(v.definition)
        stages = []
        for i, s in enumerate(d["stages"], 1):
            stages.append(
                {
                    **s,
                    "number": i,
                    "type_name": STAGE_NAMES.get(s["type"], s["type"]),
                    "map": f"https://neshan.org/maps/@{s['lat']},{s['lng']},17z" if schema.has_point(s) else "",
                }
            )
        reviews = GameReview.objects.filter(version__game=v.game).select_related("reviewer", "version").order_by("-create_time")
        own = v.game.owner.user_id == request.user.pk
        return Response(
            {
                "version": {
                    **_version_row(v),
                    "definition": {k: d[k] for k in ("title", "summary", "story", "area", "presenter", "access", "audience", "starts_at", "capacity", "finish_points", "hint_penalty", "budget_points", "completion_message", "cover")},
                    "stages": stages,
                    "max_run_points": schema.max_run_points(d),
                    "availability": availability_text(d),
                    "leaderboard": board_text(d),
                    "problems": services.problems(v.game, d),
                    "fee_toman": v.fee_toman,
                    "review_note": v.review_note,
                    "own_game": own,
                    "can_decide": v.status == GameVersion.Status.SUBMITTED and not own,
                },
                "history": [
                    {"at": r.create_time.isoformat(), "version": r.version.number, "decision": r.decision, "note": r.note, "by": r.reviewer.username or ("0" + r.reviewer.phone_number)}
                    for r in reviews
                ],
            }
        )


class DecideView(APIView):
    permission_classes = (Reviewer,)

    def post(self, request, version_id):
        data = request.data or {}
        decision = str(data.get("decision") or "")
        note = str(data.get("note") or "")
        try:
            with transaction.atomic():  # (the decision and its audit row: both or neither)
                v = services.review(request.user, version_id, decision, note)
                audit(request, f"game_{decision}", "game_version", v.pk, game=str(v.game_id), title=v.game.title, note=note[:300])
        except services.GameMasterError as exc:
            return err(exc.message, exc.code, 403 if exc.code == "forbidden" else 409)
        return Response({"version": _version_row(v)})


def _live_row(g: Game) -> dict:
    live = g.live_version
    m = getattr(live, "mystery", None) if live else None
    runs = MysteryRun.objects.filter(mystery__in=boards.scope_mysteries(m)) if m else MysteryRun.objects.none()
    agg = runs.aggregate(players=Count("customer", distinct=True), done=Count("customer", distinct=True, filter=Q(status=MysteryRun.Status.COMPLETED)))
    return {
        "id": str(g.pk),
        "title": g.title,
        "status": g.status,
        "status_name": g.get_status_display(),
        "category_name": g.get_category_display(),
        "creator": _creator(g),
        "paused_by_admin": g.paused_by_admin,
        "edition": g.edition,
        "mystery_id": str(m.pk) if m else None,
        "ends_at": m.ends_at.isoformat() if m and m.ends_at else None,
        "players": agg["players"],
        "finished": agg["done"],
        "leaderboard": (m.leaderboard or {}).get("preset", "none") if m else "none",
    }


class LiveGamesView(APIView):
    permission_classes = (Reviewer,)

    def get(self, request):
        status = request.query_params.get("status") or "live"
        groups = {"live": services.LIVE, "expired": (Game.Status.EXPIRED,), "archived": (Game.Status.ARCHIVED,)}
        qs = Game.objects.filter(live_version__isnull=False, status__in=groups.get(status, services.LIVE))
        qs = qs.select_related("owner__user", "live_version").order_by("-update_time")[:100]
        return Response({"games": [_live_row(g) for g in qs]})


ACTIONS = {
    "pause": lambda u, gid: services.set_paused(u, gid, True, by_admin=True),
    "resume": lambda u, gid: services.set_paused(u, gid, False, by_admin=True),
    "expire": lambda u, gid: services.expire_now(u, gid, "از اپ ادمین"),
    "archive": lambda u, gid: services.archive(u, gid, by_admin=True),
}


class GameActionView(APIView):
    permission_classes = (Reviewer,)

    def post(self, request, game_id, action):
        handler = ACTIONS.get(action)
        if handler is None:
            return err("کار نامعتبر است.", "not_found", 404)
        try:
            with transaction.atomic():
                g = handler(request.user, game_id)
                audit(request, f"game_{action}", "game", game_id, title=g.title)
        except services.GameMasterError as exc:
            return err(exc.message, exc.code, 404 if exc.code == "not_found" else 409)
        return Response({"game": _live_row(Game.objects.select_related("owner__user", "live_version").get(pk=g.pk))})


class GameRunsView(APIView):
    """A live game's players (for a leaderboard dispute): rank data, and «حذف از جدول»."""

    permission_classes = (Reviewer,)

    def get(self, request, game_id):
        g = Game.objects.select_related("live_version").filter(pk=game_id).first()
        m = getattr(g.live_version, "mystery", None) if g and g.live_version else None
        if m is None:
            return err("پیدا نشد.", "not_found", 404)
        runs = (
            MysteryRun.objects.filter(mystery__in=boards.scope_mysteries(m))
            .select_related("customer__user")
            .annotate(done=Count("checkins", distinct=True))
            .order_by("-points_earned", "create_time")[:200]
        )
        log = GameAuditLog.objects.filter(game=g, action="leaderboard_exclude").count()
        return Response(
            {
                "runs": [
                    {
                        "id": str(r.pk),
                        "phone": "0" + r.customer.user.phone_number,
                        "name": r.customer.user.username or "",
                        "status": r.status,
                        "stages": r.done,
                        "points": r.points_earned,
                        "started": r.create_time.isoformat(),
                        "completed": r.completed_at.isoformat() if r.completed_at else None,
                        "excluded": r.leaderboard_excluded,
                    }
                    for r in runs
                ],
                "exclusions": log,
            }
        )


class ExcludeRunView(APIView):
    permission_classes = (Reviewer,)

    def post(self, request, run_id):
        note = str((request.data or {}).get("note") or "").strip()
        try:
            with transaction.atomic():
                services.exclude_run(request.user, run_id, note)
                audit(request, "leaderboard_exclude", "run", run_id, note=note[:300])
        except services.GameMasterError as exc:
            return err(exc.message, exc.code, 404 if exc.code == "not_found" else 400)
        return Response({"ok": True})
