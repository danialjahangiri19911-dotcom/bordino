"""A creator game's definition (JSON, schema 1): what the editor saves, what a version freezes, and
what publication compiles into a Mystery. Nothing in it is ever run as code: each stage is one of a
fixed set of types the mission engine already checks on the server.

    {"schema": 1, "title", "summary", "story", "area", "duration_minutes", "presenter",
     "access": "public"|"private", "audience": {"age_min", "age_max", "gender"},
     "starts_at", "ends_at", "capacity", "finish_points", "hint_penalty", "budget_points",
     "completion_message",
     "availability": {"expiry": "none"|"date"|"duration", "duration_value", "duration_unit": "days"|"months",
                      "after": "strict"|"finish", "grace_hours"},   (a "date" expiry is `ends_at`)
     "leaderboard": {...}   (apps.missions.leaderboard; preset "none" = no leaderboard),
     "stages": [{"id", "type", "title", "text", "image", "question", "answers", "answer_type",
                 "options", "lat", "lng", "radius_m", "check_location", "staff_code",
                 "place": {"name", "address", "about", "offer", "url"},
                 "hints": [...], "points", "time_limit_s", "coupon"}]}

Stage types: question, puzzle (an answer; text or number), choice (one right option), qr (the
place's QR), location (the phone at the place), staff (a code the staff give), media (read, then
«ادامه»), reward (a coupon or message, then «ادامه»).
"""

import json
import math
import re
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from django.utils import timezone
from django.utils.dateparse import parse_datetime

from dateutil.relativedelta import relativedelta

from apps.missions import leaderboard as boards

SCHEMA = 1
STAGE_TYPES = ("question", "puzzle", "choice", "qr", "location", "staff", "media", "reward")
# The proof each stage type compiles to (MysteryStep.Proof).
PROOF_OF = {
    "question": "answer",
    "puzzle": "answer",
    "choice": "choice",
    "qr": "qr",
    "location": "gps",
    "staff": "staff",
    "media": "info",
    "reward": "info",
}
MAX_STAGES = 20
MAX_BYTES = 64 * 1024
MAX_STAGE_POINTS = 500
# A mission location must be in Iran (a rough box: the review checks the exact place).
IRAN = (24.0, 40.5, 43.5, 64.0)
EXPIRY = ("none", "date", "duration")
# Dates and durations are on Tehran's clock: «one month» from 10 Nov 18:00 is 10 Dec 18:00 there
# (a calendar month, not 30 days; the 31st becomes the month's last day).
ZONE = ZoneInfo("Asia/Tehran")
MAX_DURATION = {"days": 3650, "months": 120}
MAX_GRACE_HOURS = 24 * 30


class DefinitionError(Exception):
    """The definition is not valid: `errors` maps a path ("stages.2.answers") to a message."""

    def __init__(self, errors: dict):
        super().__init__("; ".join(f"{k}: {v}" for k, v in errors.items()))
        self.errors = errors


def empty() -> dict:
    return {"schema": SCHEMA, "title": "", "access": "public", "audience": {}, "finish_points": 0, "hint_penalty": 25, "budget_points": 0, "stages": []}


def availability(raw, ends_at) -> dict:
    """When the game stops taking players, and what those already playing may still do."""
    a = raw if isinstance(raw, dict) else {}
    # (A draft from before this setting: its end date, or no end.)
    expiry = a.get("expiry") if a.get("expiry") in EXPIRY else ("date" if ends_at else "none")
    unit = "months" if a.get("duration_unit") == "months" else "days"
    after = "finish" if a.get("after") == "finish" else "strict"
    return {
        "expiry": expiry,
        "duration_value": _int(a.get("duration_value"), 1, MAX_DURATION[unit]),
        "duration_unit": unit,
        "after": after,
        "grace_hours": (_int(a.get("grace_hours"), 0, MAX_GRACE_HOURS) or 0) if after == "finish" else 0,
    }


def end_times(definition: dict, published_at: datetime) -> tuple[datetime | None, datetime | None]:
    """(ends_at, grace_ends_at) of a version published at `published_at`: a duration counts from the
    actual publication, on Tehran's clock."""
    a = definition.get("availability") or availability(None, definition.get("ends_at"))
    end = None
    if a["expiry"] == "date" and definition.get("ends_at"):
        end = parse_datetime(definition["ends_at"])
    elif a["expiry"] == "duration" and a.get("duration_value"):
        local = timezone.localtime(published_at, ZONE)
        step = relativedelta(months=a["duration_value"]) if a["duration_unit"] == "months" else timedelta(days=a["duration_value"])
        end = local + step
    grace = end + timedelta(hours=a["grace_hours"]) if end and a["after"] == "finish" and a["grace_hours"] else None
    return end, grace


def length_days(definition: dict, now: datetime) -> float | None:
    """How long the game would run if published now (None = no end)."""
    end, _ = end_times(definition, now)
    return None if end is None else (end - now).total_seconds() / 86400


# An image is one of the creator's uploads (GameAsset): "gm/<32 hex>.<ext>", nothing else.
IMAGE = re.compile(r"^gm/[0-9a-f]{32}\.(?:jpg|jpeg|png|webp)$")


def _image(value) -> str | None:
    value = str(value or "").strip()
    return value if IMAGE.match(value) else None


def images(definition: dict) -> set[str]:
    """Every image a definition uses (its cover and its stages')."""
    found = {definition.get("cover")} | {s.get("image") for s in definition.get("stages") or []}
    return {x for x in found if x}


def _text(value, limit: int) -> str:
    return str(value or "").strip()[:limit]


def _int(value, low: int, high: int) -> int | None:
    if value in (None, ""):
        return None
    try:
        number = int(value)
    except (TypeError, ValueError):
        return None
    return max(low, min(high, number))


def _float(value) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def _when(value) -> str | None:
    if not value:
        return None
    parsed = parse_datetime(str(value)) if not isinstance(value, datetime) else value
    return parsed.isoformat() if parsed else None


def clean(definition) -> dict:
    """The definition in its stored form: known keys only, every value bounded (unknown keys and
    oversized texts dropped). It may still be incomplete (a draft); `check` says what is missing."""
    if not isinstance(definition, dict):
        raise DefinitionError({"": "تعریف بازی خراب است."})
    if len(json.dumps(definition, ensure_ascii=False)) > MAX_BYTES:
        raise DefinitionError({"": "بازی خیلی بزرگ است؛ متن‌ها یا مرحله‌ها را کم کنید."})
    audience = definition.get("audience") if isinstance(definition.get("audience"), dict) else {}
    out = {
        "schema": SCHEMA,
        "title": _text(definition.get("title"), 120),
        "summary": _text(definition.get("summary"), 200),
        "story": _text(definition.get("story"), 3000),
        "area": _text(definition.get("area"), 120),
        "duration_minutes": _int(definition.get("duration_minutes"), 1, 1440),
        "presenter": _text(definition.get("presenter"), 120),
        "cover": _image(definition.get("cover")),
        "access": "private" if definition.get("access") == "private" else "public",
        "audience": {
            "age_min": _int(audience.get("age_min"), 0, 120),
            "age_max": _int(audience.get("age_max"), 0, 120),
            "gender": audience.get("gender") if audience.get("gender") in ("M", "F") else "",
        },
        "starts_at": _when(definition.get("starts_at")),
        "ends_at": _when(definition.get("ends_at")),
        "capacity": _int(definition.get("capacity"), 1, 1_000_000),
        "finish_points": _int(definition.get("finish_points"), 0, MAX_STAGE_POINTS) or 0,
        "hint_penalty": _int(definition.get("hint_penalty"), 0, 100) if definition.get("hint_penalty") not in (None, "") else 25,
        "budget_points": _int(definition.get("budget_points"), 0, 10_000_000) or 0,
        "completion_message": _text(definition.get("completion_message"), 1000),
        "availability": availability(definition.get("availability"), definition.get("ends_at")),
        "leaderboard": boards.clean(definition.get("leaderboard")),
        "stages": [],
    }
    if out["availability"]["expiry"] != "date":
        out["ends_at"] = None  # (the end is then a duration, or none)
    stages = definition.get("stages") if isinstance(definition.get("stages"), list) else []
    for raw in stages[:MAX_STAGES]:
        if not isinstance(raw, dict):
            continue
        place = raw.get("place") if isinstance(raw.get("place"), dict) else {}
        kind = raw.get("type") if raw.get("type") in STAGE_TYPES else "question"
        out["stages"].append(
            {
                "id": _text(raw.get("id"), 40) or f"s{len(out['stages']) + 1}",
                "type": kind,
                "title": _text(raw.get("title"), 120),
                "text": _text(raw.get("text"), 2000),
                "image": _image(raw.get("image")),
                "question": _text(raw.get("question"), 200),
                "answers": [a for a in (_text(x, 100) for x in (raw.get("answers") or [])[:10]) if a],
                "answer_type": "number" if raw.get("answer_type") == "number" else "text",
                "options": [o for o in (_text(x, 100) for x in (raw.get("options") or [])[:8]) if o],
                "lat": _float(raw.get("lat")),
                "lng": _float(raw.get("lng")),
                "radius_m": _int(raw.get("radius_m"), 20, 2000) or 100,
                "check_location": bool(raw.get("check_location")),
                "qr_rotating": bool(raw.get("qr_rotating")) and kind == "qr",
                "staff_code": _text(raw.get("staff_code"), 40),
                "place": {
                    "name": _text(place.get("name"), 120),
                    "address": _text(place.get("address"), 250),
                    "about": _text(place.get("about"), 1000),
                    "offer": _text(place.get("offer"), 200),
                    "url": _text(place.get("url"), 300),
                },
                "hints": [h for h in (_text(x, 300) for x in (raw.get("hints") or [])[:6]) if h],
                "points": _int(raw.get("points"), 0, MAX_STAGE_POINTS) or 0,
                "time_limit_s": _int(raw.get("time_limit_s"), 10, 86_400),
                "coupon": _text(raw.get("coupon"), 120),
            }
        )
    return out


def has_point(stage: dict) -> bool:
    return stage.get("lat") is not None and stage.get("lng") is not None


def max_run_points(definition: dict) -> int:
    return sum(s.get("points") or 0 for s in definition.get("stages", [])) + (definition.get("finish_points") or 0)


def check(definition: dict) -> dict:
    """What stops this definition from being submitted: {path: message}; empty = ready."""
    d = clean(definition)
    errors = {}
    if not d["title"]:
        errors["title"] = "عنوان بازی را بنویسید."
    if not d["stages"]:
        errors["stages"] = "دست‌کم یک مرحله بسازید."
    if d["starts_at"] and d["ends_at"] and d["ends_at"] <= d["starts_at"]:
        errors["ends_at"] = "پایان باید بعد از شروع باشد."
    a = d["audience"]
    if a["age_min"] is not None and a["age_max"] is not None and a["age_max"] < a["age_min"]:
        errors["audience.age_max"] = "حداکثر سن باید از حداقل بیشتر باشد."
    if a["age_min"] is not None and a["age_min"] < 7:
        errors["audience.age_min"] = "کمترین سن مخاطب ۷ سال است."
    ids = set()
    for i, s in enumerate(d["stages"]):
        p = f"stages.{i}"
        if s["id"] in ids:
            errors[f"{p}.id"] = "شناسهٔ مرحله تکراری است."
        ids.add(s["id"])
        if not s["title"] and not s["text"]:
            errors[f"{p}.text"] = "متن یا سرنخ این مرحله را بنویسید."
        t = s["type"]
        if t in ("question", "puzzle"):
            if not s["question"]:
                errors[f"{p}.question"] = "پرسش را بنویسید."
            if not s["answers"]:
                errors[f"{p}.answers"] = "پاسخ درست را بنویسید."
        if t == "choice":
            if not s["question"]:
                errors[f"{p}.question"] = "پرسش را بنویسید."
            if len(s["options"]) < 2:
                errors[f"{p}.options"] = "دست‌کم دو گزینه بنویسید."
            elif len(set(s["options"])) != len(s["options"]):
                errors[f"{p}.options"] = "گزینه‌ها نباید تکراری باشند."
            elif not s["answers"] or s["answers"][0] not in s["options"]:
                errors[f"{p}.answers"] = "گزینهٔ درست را انتخاب کنید."
        if t == "staff" and not s["staff_code"]:
            errors[f"{p}.staff_code"] = "کدی را که کارکنان محل می‌گویند بنویسید."
        needs_point = t == "location" or s["check_location"]
        if needs_point and not has_point(s):
            errors[f"{p}.lat"] = "مختصات محل را روی نقشه یا با عدد مشخص کنید."
        if has_point(s):
            lat, lng = s["lat"], s["lng"]
            if not (IRAN[0] <= lat <= IRAN[1] and IRAN[2] <= lng <= IRAN[3]):
                errors[f"{p}.lat"] = "محل باید داخل ایران باشد."
        if t in ("qr", "location", "staff") and not s["place"]["name"]:
            errors[f"{p}.place.name"] = "نام محل را بنویسید (بعد از رسیدن نشان داده می‌شود)."
    a = d["availability"]
    if a["expiry"] == "date" and not d["ends_at"]:
        errors["ends_at"] = "تاریخ و ساعت پایان را انتخاب کن."
    if a["expiry"] == "duration" and not a["duration_value"]:
        errors["availability.duration_value"] = "مدت بازی را بنویس."
    errors.update(boards.problems(d["leaderboard"]))
    need = max_run_points(d)
    if need and d["budget_points"] < need:
        errors["budget_points"] = f"بودجه دست‌کم باید به اندازهٔ جایزهٔ یک بازیکن ({need} امتیاز) باشد."
    return errors


def compile_steps(definition: dict) -> list[dict]:
    """The MysteryStep fields of each stage, in order (publication creates them)."""
    steps = []
    for i, s in enumerate(clean(definition)["stages"], 1):
        proof = PROOF_OF[s["type"]]
        place = s["place"]
        is_place = s["type"] in ("qr", "location", "staff") or has_point(s) or bool(place["name"] and place["address"])
        steps.append(
            {
                "order": i,
                "clue": "\n\n".join(x for x in (s["title"], s["text"]) if x) or s["question"] or "—",
                "clue_image": s["image"] or "",
                "hints": "\n".join(s["hints"]),
                "points": s["points"],
                "proof": proof,
                "question": s["question"],
                "answers": "|".join(s["answers"]) if proof in ("answer", "choice") else "",
                "answer_type": s["answer_type"],
                "options": s["options"] if proof == "choice" else [],
                "staff_code": s["staff_code"] if proof == "staff" else "",
                "latitude": f"{s['lat']:.6f}" if has_point(s) else None,
                "longitude": f"{s['lng']:.6f}" if has_point(s) else None,
                "radius_m": s["radius_m"],
                "check_location": bool(s["check_location"] and proof in ("answer", "staff", "choice", "info")),
                "qr_rotating": bool(s.get("qr_rotating")) and proof == "qr",
                "time_limit_s": s["time_limit_s"],
                "coupon_text": s["coupon"],
                "is_place": is_place,
                "place_name": place["name"] or s["title"] or f"مرحلهٔ {i}",
                "place_address": place["address"],
                "place_about": place["about"],
                "place_offer": place["offer"],
                "place_url": place["url"] if place["url"].startswith(("http://", "https://")) else "",
            }
        )
    return steps
