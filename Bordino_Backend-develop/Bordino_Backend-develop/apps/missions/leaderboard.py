"""The leaderboard of a city mystery / creator game: one engine for every game, configured by data.

Everything is ranked from what the server itself recorded: a player's solved stages are their
MysteryCheckins (one per stage, so a stage proved twice still counts once), their score is the points
the server paid (`MysteryRun.points_earned`), their time is from starting to finishing (both server
timestamps). Nothing a phone sends is taken as a rank or a score.

A board covers one *scope*: all the versions of one edition of a creator's game (a new version keeps
its players' standing; a new edition starts afresh), or one mystery made by Bordino. Each player
counts once (their first run in the scope). Order is deterministic: the configured metrics, then who
reached their result first, then who started first, then the run's id.

A config ({} or preset "none" = no leaderboard) is kept on the Mystery and frozen in the approved
version, so its rules only change through a new review:

    {"preset", "customized", "rank_by": [metric, ...], "only_finishers", "visibility", "after",
     "period", "attempts", "top", "full", "highlight_me", "show": {field: bool}}
"""

from __future__ import annotations

from copy import deepcopy
from datetime import timedelta

from django.core.cache import cache
from django.db import transaction
from django.db.models import Count, DurationField, ExpressionWrapper, F, FloatField, Max, OuterRef, Q, Subquery, Value
from django.db.models.functions import Cast, Coalesce, NullIf
from django.utils import timezone

from apps.missions.models import LeaderboardSnapshot, Mystery, MysteryRun, MysteryStep

RunStatus = MysteryRun.Status

# metric: (label, ordering) — "stages" also stands for «مأموریت‌های انجام‌شده» (each stage is one
# distinct validated mission of the game; repeating one never counts again).
METRICS = {
    "stages": "مرحله‌های انجام‌شده",
    "progress": "درصد پیشرفت",
    "score": "امتیاز",
    "duration": "زمان تمام کردن",
}
# Known but not offered yet: team play needs team sessions the game runtime does not have.
UNSUPPORTED_METRICS = {"team": "امتیاز تیم"}
VISIBILITY = ("players", "finishers", "creator")
AFTER = ("keep", "top10", "hide", "participants", "creator")
# Only the game's whole life for now; the others need period boundaries the events do not keep yet.
PERIODS = ("lifetime",)
FUTURE_PERIODS = ("daily", "weekly", "monthly", "range")
# One run per player per edition: the first valid attempt is the only one there is.
ATTEMPTS = ("first",)
TOPS = (3, 10, 20, 50)
SHOW = ("rank", "name", "avatar", "stages", "percent", "bar", "score", "time", "participants", "finishers")

_SHOW_ALL_OFF = {k: False for k in SHOW}


def _show(*on: str) -> dict:
    return {**_SHOW_ALL_OFF, **{k: True for k in on}}


PRESETS = {
    "progress": {
        "name": "بیشترین مرحله",
        "rank_by": ["stages", "score"],
        "only_finishers": False,
        "show": _show("rank", "name", "avatar", "stages", "bar", "participants", "finishers"),
    },
    "score": {
        "name": "بیشترین امتیاز",
        "rank_by": ["score", "stages", "duration"],
        "only_finishers": False,
        "show": _show("rank", "name", "avatar", "score", "stages", "participants", "finishers"),
    },
    "speed": {
        "name": "سریع‌ترین پایان",
        "rank_by": ["duration", "score"],
        "only_finishers": True,
        "show": _show("rank", "name", "avatar", "time", "participants", "finishers"),
    },
    "participation": {
        "name": "فعالیت و مشارکت",
        "rank_by": ["stages", "score"],
        "only_finishers": False,
        "show": _show("rank", "name", "avatar", "stages", "score", "participants"),
    },
}
# Team competition: named, kept off until the runtime has teams (no team data is ever made up).
TEAM_PRESET = "team"
NO_BOARD = "none"
COMMON = {"visibility": "players", "after": "keep", "period": "lifetime", "attempts": "first", "top": 10, "full": True, "highlight_me": True}


def preset_config(preset: str) -> dict:
    """A preset's whole config (its defaults); "none" (or unknown) is no leaderboard."""
    if preset not in PRESETS:
        return {"preset": NO_BOARD}
    p = PRESETS[preset]
    return {"preset": preset, "customized": False, **deepcopy(COMMON), "rank_by": list(p["rank_by"]),
            "only_finishers": p["only_finishers"], "show": dict(p["show"])}


def clean(raw) -> dict:
    """The stored form of a config: known keys and values only (unknown ones dropped). Values that
    are not offered (a team board, a daily period) are kept as given so `problems` can say why."""
    if not isinstance(raw, dict) or raw.get("preset") in (None, "", NO_BOARD):
        return {"preset": NO_BOARD}
    preset = raw.get("preset")
    if preset == TEAM_PRESET:
        return {"preset": TEAM_PRESET}
    if preset not in PRESETS:
        return {"preset": NO_BOARD}
    base = preset_config(preset)
    out = {**base, "customized": bool(raw.get("customized"))}
    if not out["customized"]:
        return base
    rank_by = [str(m) for m in (raw.get("rank_by") or [])[:3] if isinstance(m, str)]
    out["rank_by"] = [m for m in rank_by if m in METRICS or m in UNSUPPORTED_METRICS] or base["rank_by"]
    out["only_finishers"] = bool(raw.get("only_finishers"))
    for key, allowed in (("visibility", VISIBILITY), ("after", AFTER), ("attempts", ATTEMPTS)):
        out[key] = raw.get(key) if raw.get(key) in allowed else base[key]
    out["period"] = raw.get("period") if raw.get("period") in PERIODS + FUTURE_PERIODS else "lifetime"
    out["top"] = raw.get("top") if raw.get("top") in TOPS else base["top"]
    out["full"] = bool(raw.get("full", True))
    out["highlight_me"] = bool(raw.get("highlight_me", True))
    show = raw.get("show") if isinstance(raw.get("show"), dict) else {}
    out["show"] = {k: bool(show.get(k, base["show"][k])) for k in SHOW}
    return out


def enabled(cfg: dict | None) -> bool:
    return bool(cfg) and cfg.get("preset") in PRESETS


def problems(cfg: dict) -> dict:
    """What makes this config unusable: {path: message} (paths under "leaderboard.")."""
    errors = {}
    if cfg.get("preset") == TEAM_PRESET:
        errors["leaderboard.preset"] = "رقابت تیمی هنوز فعال نیست؛ یکی از جدول‌های دیگر را انتخاب کن."
        return errors
    if not enabled(cfg):
        return errors
    rank_by = cfg.get("rank_by") or []
    if any(m in UNSUPPORTED_METRICS for m in rank_by):
        errors["leaderboard.rank_by"] = "رتبه‌بندی تیمی هنوز فعال نیست."
    elif len(set(rank_by)) != len(rank_by):
        errors["leaderboard.rank_by"] = "یک معیار دو بار انتخاب شده است."
    elif "stages" in rank_by and "progress" in rank_by:
        errors["leaderboard.rank_by"] = "«مرحله‌ها» و «درصد پیشرفت» یک چیز را می‌سنجند؛ فقط یکی را انتخاب کن."
    elif rank_by and rank_by[0] == "duration" and not cfg.get("only_finishers"):
        errors["leaderboard.only_finishers"] = "وقتی رتبه با زمان است، فقط کسانی که بازی را تمام کرده‌اند رتبه می‌گیرند."
    if cfg.get("period") not in PERIODS:
        errors["leaderboard.period"] = "فعلاً فقط «کل دورهٔ بازی» در دسترس است."
    if not any(cfg.get("show", {}).get(k) for k in ("stages", "percent", "bar", "score", "time")):
        errors["leaderboard.show"] = "دست‌کم یکی از مرحله، پیشرفت، امتیاز یا زمان را نشان بده."
    return errors


def describe(cfg: dict) -> str:
    """The rules in one line, for the player before they join (and for the review)."""
    if not enabled(cfg):
        return ""
    names = " ← ".join(METRICS.get(m, m) for m in cfg["rank_by"])
    who = "فقط کسانی که بازی را تمام کنند" if cfg.get("only_finishers") else "همهٔ بازیکنانی که دست‌کم یک مرحله را حل کنند"
    return f"رتبه بر اساس {names}؛ در تساوی، کسی که زودتر رسیده جلوتر است. {who} در جدول می‌آیند. هر بازیکن یک بار بازی می‌کند."


# ── scope ──


def scope_of(mystery: Mystery) -> str:
    if mystery.series:
        return f"game:{mystery.series}:{mystery.edition}"
    return f"mystery:{mystery.pk}"


def scope_mysteries(mystery: Mystery):
    if mystery.series:
        return Mystery.objects.filter(series=mystery.series, edition=mystery.edition)
    return Mystery.objects.filter(pk=mystery.pk)


def current_mystery(mystery: Mystery) -> Mystery:
    """The scope's newest version (its rules and dates are the board's)."""
    if not mystery.series:
        return mystery
    return scope_mysteries(mystery).order_by("-create_time").first() or mystery


def ended_at(mystery: Mystery):
    """When nobody can make progress any more (the end, or the end of its grace), or None."""
    if not mystery.ends_at:
        return None
    return max(mystery.ends_at, mystery.grace_ends_at or mystery.ends_at)


# ── ranking ──


def _runs(mystery: Mystery):
    """The scope's runs that count: each player's first, not taken off the board."""
    in_scope = MysteryRun.objects.filter(mystery__in=scope_mysteries(mystery))
    first = in_scope.order_by("customer_id", "create_time", "id").distinct("customer_id").values("id")
    total = Subquery(
        MysteryStep.objects.filter(mystery=OuterRef("mystery")).values("mystery").annotate(n=Count("id")).values("n")[:1]
    )
    return (
        MysteryRun.objects.filter(id__in=Subquery(first), leaderboard_excluded=False)
        .annotate(
            n_done=Count("checkins", distinct=True),
            n_total=Coalesce(total, Value(0)),
            reached=Coalesce(Max("checkins__create_time"), F("create_time")),
            took=ExpressionWrapper(F("completed_at") - F("create_time"), output_field=DurationField()),
        )
        .annotate(progress=ExpressionWrapper(Cast("n_done", FloatField()) / NullIf(Cast("n_total", FloatField()), 0.0), output_field=FloatField()))
    )


ORDER = {
    "stages": F("n_done").desc(),
    "progress": F("progress").desc(nulls_last=True),
    "score": F("points_earned").desc(),
    "duration": F("took").asc(nulls_last=True),
}


def _eligible(qs, cfg: dict):
    if cfg.get("only_finishers"):
        return qs.filter(status=RunStatus.COMPLETED)
    return qs.filter(Q(n_done__gte=1) | Q(status=RunStatus.COMPLETED))


def ordering(cfg: dict) -> list:
    return [ORDER[m] for m in cfg["rank_by"] if m in ORDER] + [F("reached").asc(), F("create_time").asc(), F("id").asc()]


def _key(mystery: Mystery, cfg: dict) -> str:
    return f"leaderboard:{scope_of(mystery)}:{'-'.join(cfg['rank_by'])}:{int(bool(cfg.get('only_finishers')))}"


def _ordered_ids(mystery: Mystery, cfg: dict) -> list[tuple[str, str]]:
    """(run id, customer id) of the ranked players, best first; kept 30 s (fresh enough while a game
    runs, and one query however many look)."""
    key = _key(mystery, cfg)
    found = cache.get(key)
    if found is None:
        found = [(str(r), str(c)) for r, c in _eligible(_runs(mystery), cfg).order_by(*ordering(cfg)).values_list("id", "customer_id")]
        cache.set(key, found, 30)
    return found


def forget(mystery: Mystery):
    """Drops the cached order (after Bordino takes a run off the board)."""
    for cfg in [mystery.leaderboard] + [preset_config(p) for p in PRESETS]:
        cfg = clean(cfg)
        if enabled(cfg):
            cache.delete(_key(mystery, cfg))


def _masked(name: str) -> str:
    name = (name or "").strip()
    return (name[0] + "***") if name else "بازیکن"


def _row(run, position: int, me_id, cfg: dict, request=None) -> dict:
    show = cfg["show"]
    mine = me_id is not None and str(run.customer_id) == str(me_id)
    public = mine or run.show_identity
    user = getattr(run.customer, "user", None)
    name = (user.username if user else "") or ""
    avatar = None
    if show["avatar"] and public and run.customer.image_id and getattr(run.customer.image, "file", None):
        try:
            url = run.customer.image.file.url
            avatar = request.build_absolute_uri(url) if request else url
        except ValueError:
            avatar = None
    took = run.took.total_seconds() if run.took is not None and run.status == RunStatus.COMPLETED else None
    return {
        "position": position,
        "name": (name or "بازیکن") if public else (_masked(name) if show["name"] else f"بازیکن {position}"),
        "avatar": avatar,
        "is_me": mine,
        "stages": run.n_done,
        "total": run.n_total,
        "percent": round(100 * run.n_done / run.n_total) if run.n_total else 0,
        "score": run.points_earned,
        "seconds": int(took) if took is not None else None,
        "completed": run.status == RunStatus.COMPLETED,
    }


def totals(mystery: Mystery) -> dict:
    runs = MysteryRun.objects.filter(mystery__in=scope_mysteries(mystery))
    agg = runs.aggregate(
        players=Count("customer", distinct=True),
        finishers=Count("customer", distinct=True, filter=Q(status=RunStatus.COMPLETED)),
    )
    return {"players": agg["players"], "finishers": agg["finishers"], "stages": current_mystery(mystery).steps.count()}


def snapshot_of(mystery: Mystery) -> LeaderboardSnapshot | None:
    """The scope's final result in force (the newest; corrections replace it)."""
    return LeaderboardSnapshot.objects.filter(scope=scope_of(mystery)).order_by("-create_time").first()


def live_rows(mystery: Mystery, cfg: dict, ids: list[str], me_id=None, request=None, positions: dict | None = None) -> list[dict]:
    runs = {str(r.pk): r for r in _runs(mystery).filter(id__in=ids).select_related("customer__user", "customer__image")}
    return [_row(runs[i], positions[i], me_id, cfg, request) for i in ids if i in runs]


# ── who sees what ──


def access(mystery: Mystery, customer, staff: bool = False) -> tuple[bool, int | None, str]:
    """Whether this viewer sees the board, how many rows at most (None = all), and why not."""
    cur = current_mystery(mystery)
    cfg = clean(cur.leaderboard)
    if not enabled(cfg):
        return False, None, "off"
    if staff:
        return True, None, ""
    run = (
        MysteryRun.objects.filter(mystery__in=scope_mysteries(cur), customer=customer).order_by("create_time").first()
        if customer is not None
        else None
    )
    end = ended_at(cur)
    finished_game = end is not None and timezone.now() >= end
    rule = cfg["visibility"]
    cap = None if cfg["full"] else cfg["top"]
    if finished_game:
        after = cfg["after"]
        if after == "hide":
            return False, None, "hidden"
        if after == "creator":
            return False, None, "creator_only"
        if after == "top10":
            cap = min(cap or 10, 10)
        if after == "participants":
            rule = "players"
    if rule == "creator":
        return False, None, "creator_only"
    if run is None:
        return False, None, "not_playing"
    if rule == "finishers" and run.status != RunStatus.COMPLETED:
        return False, None, "finish_first"
    return True, cap, ""


def board(mystery: Mystery, customer=None, offset: int = 0, limit: int | None = None, staff: bool = False, request=None) -> dict:
    """One page of the board for this viewer, their own row (wherever it is), and the totals."""
    cur = current_mystery(mystery)
    cfg = clean(cur.leaderboard)
    ok, cap, why = access(cur, customer, staff)
    out = {"enabled": enabled(cfg), "visible": ok, "reason": why, "totals": totals(cur), "config": public_config(cfg)}
    if not ok:
        return out
    me_id = getattr(customer, "pk", None)
    snap = snapshot_of(cur)
    limit = max(1, min(int(limit or cfg["top"]), 50))
    offset = max(0, int(offset or 0))
    if snap is not None:
        ranked = snap.rows
        count = len(ranked)
        end = count if cap is None else min(count, cap)
        page = ranked[offset : min(offset + limit, end)]
        rows = [_snap_row(r, me_id, cfg) for r in page]
        mine = next((r for r in ranked if me_id is not None and r["customer"] == str(me_id)), None)
        out.update(final=True, finalized_at=snap.create_time.isoformat())
        out["me"] = _snap_row(mine, me_id, cfg) if mine else None
    else:
        ranked_ids = _ordered_ids(cur, cfg)
        count = len(ranked_ids)
        end = count if cap is None else min(count, cap)
        page_ids = [r for r, _ in ranked_ids[offset : min(offset + limit, end)]]
        positions = {r: i + 1 for i, (r, _) in enumerate(ranked_ids)}
        mine_id = next((r for r, c in ranked_ids if me_id is not None and c == str(me_id)), None)
        wanted = page_ids + ([mine_id] if mine_id and mine_id not in page_ids else [])
        rows_all = live_rows(cur, cfg, wanted, me_id, request, positions)
        rows = [r for r in rows_all if not (r["is_me"] and mine_id not in page_ids)]
        out["me"] = next((r for r in rows_all if r["is_me"]), None)
        out["final"] = False
        # Still open to progress (or within its grace): results may change until it ends.
    out.update(rows=rows, count=end, offset=offset, more=offset + limit < end)
    if me_id is not None:
        run = MysteryRun.objects.filter(mystery__in=scope_mysteries(cur), customer=customer).order_by("create_time").first()
        out["show_identity"] = bool(run and run.show_identity)
        if out.get("me") is None:
            out["my_progress"] = {"stages": run.checkins.count(), "completed": run.status == RunStatus.COMPLETED} if run else None
    return out


def _snap_row(r: dict, me_id, cfg: dict) -> dict:
    mine = me_id is not None and r["customer"] == str(me_id)
    show = cfg["show"]
    public = mine or r.get("public")
    name = r.get("name") or ""
    return {
        "position": r["position"],
        "name": (name or "بازیکن") if public else (_masked(name) if show["name"] else f"بازیکن {r['position']}"),
        "avatar": r.get("avatar") if (public and show["avatar"]) else None,
        "is_me": mine,
        "stages": r["stages"],
        "total": r["total"],
        "percent": r["percent"],
        "score": r["score"],
        "seconds": r["seconds"],
        "completed": r["completed"],
    }


def public_config(cfg: dict) -> dict:
    """What the player app needs of the rules (and the rules in words)."""
    if not enabled(cfg):
        return {"preset": cfg.get("preset", NO_BOARD)}
    return {
        "preset": cfg["preset"],
        "name": PRESETS[cfg["preset"]]["name"],
        "rank_by": cfg["rank_by"],
        "only_finishers": cfg["only_finishers"],
        "show": cfg["show"],
        "highlight_me": cfg["highlight_me"],
        "top": cfg["top"],
        "full": cfg["full"],
        "rules": describe(cfg),
    }


# ── the final result ──


def finalize(mystery: Mystery, reason: str = "final", actor=None, note: str = "") -> LeaderboardSnapshot | None:
    """Freezes the scope's result (once; a correction adds a new snapshot that replaces the last)."""
    cur = current_mystery(mystery)
    cfg = clean(cur.leaderboard)
    if not enabled(cfg):
        return None
    scope = scope_of(cur)
    with transaction.atomic():
        # One at a time per scope (two timers, or a timer and an admin, never freeze it twice).
        Mystery.objects.select_for_update().filter(pk=cur.pk).first()
        last = LeaderboardSnapshot.objects.filter(scope=scope).order_by("-create_time").first()
        if last is not None and reason == "final":
            return last
        ranked = [
            r
            for r in _eligible(_runs(cur), cfg).order_by(*ordering(cfg)).select_related("customer__user", "customer__image")
        ]
        rows = []
        for i, run in enumerate(ranked, 1):
            row = _row(run, i, None, {**cfg, "show": {**cfg["show"], "avatar": True, "name": True}})
            user = getattr(run.customer, "user", None)
            rows.append({**row, "run": str(run.pk), "customer": str(run.customer_id), "public": run.show_identity,
                         "name": (user.username if user else "") or "",
                         "avatar": row["avatar"] if run.show_identity else None})
        return LeaderboardSnapshot.objects.create(
            scope=scope, mystery=cur, rows=rows, totals=totals(cur), reason=reason, note=note, replaces=last if reason != "final" else None,
            created_by=actor,
        )


def exclude(run: MysteryRun, actor, note: str) -> LeaderboardSnapshot | None:
    """Bordino takes a run off the board (cheating, a dispute): recorded, and a frozen result is
    corrected by a new snapshot (the old one is kept)."""
    with transaction.atomic():
        MysteryRun.objects.filter(pk=run.pk).update(leaderboard_excluded=True, update_time=timezone.now())
    run.refresh_from_db()
    forget(run.mystery)
    if snapshot_of(run.mystery) is not None:
        return finalize(run.mystery, reason="correction", actor=actor, note=note)
    return None


def window_left(mystery: Mystery, now=None) -> timedelta | None:
    end = ended_at(mystery)
    if end is None:
        return None
    return end - (now or timezone.now())
