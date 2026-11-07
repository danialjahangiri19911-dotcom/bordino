"""Missions: what a player can do now, starting a try, and paying it.

Every payment goes through `_pay` (one ActivityTransaction per completed try, unique by its id), or
for a video through the rewarded-ad service, which pays its own transaction. Changes of a player's
tries happen under a lock on the player (as the rewarded ad does), so two requests at the same moment
cannot both use the last free try of the day.
"""

import hashlib
import hmac
import time
import uuid
from dataclasses import dataclass
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone

from apps.missions.models import Mission, MissionAttempt, MysteryStep
from apps.users.models.customer import Customer
from apps.wallet.models.transactions.activity import ActivityTransaction
from apps.wallet.services import ad_reward

SECTION = "mission"
# A mission that has ended stays in the list (as «پایان‌یافته») this long.
SHOW_ENDED_FOR = timedelta(days=14)
PROOF_MAX_BYTES = 5 * 1024 * 1024
PROOF_FORMATS = {"JPEG": "jpg", "PNG": "png", "WEBP": "webp"}

Status = MissionAttempt.Status
TAKEN = (Status.PENDING, Status.COMPLETED)

# Why a mission cannot be done now (and the player's message when they try).
UNAVAILABLE = {
    "inactive": "این مأموریت فعلاً غیرفعال است.",
    "upcoming": "این مأموریت هنوز شروع نشده است.",
    "expired": "زمان این مأموریت تمام شده است.",
    "full": "ظرفیت این مأموریت تکمیل شده است.",
}


class MissionError(Exception):
    """Refused, with a message for the player."""

    def __init__(self, message: str, code: str = "invalid"):
        super().__init__(message)
        self.message = message
        self.code = code


class NotFound(MissionError):
    def __init__(self, message: str = "این مأموریت پیدا نشد."):
        super().__init__(message, "not_found")


def _lock(customer: Customer):
    Customer.objects.select_for_update(no_key=True).filter(pk=customer.pk).first()


def _limit(mission: Mission) -> int:
    return mission.daily_limit if mission.repeat == Mission.Repeat.DAILY else 1


def _used(customer: Customer, mission: Mission) -> int:
    """Tries that use up the limit: completed or waiting for review (today, for a daily mission)."""
    q = MissionAttempt.objects.filter(customer=customer, mission=mission, status__in=TAKEN)
    if mission.repeat == Mission.Repeat.DAILY:
        q = q.filter(day=ad_reward.today())
    return q.count()


def _taken_total(mission: Mission) -> int:
    return MissionAttempt.objects.filter(mission=mission, status__in=TAKEN).count()


def unavailable(mission: Mission, now=None, taken_total: int | None = None) -> str | None:
    """Why nobody can do the mission now, or None."""
    now = now or timezone.now()
    if not mission.is_active:
        return "inactive"
    if mission.starts_at and now < mission.starts_at:
        return "upcoming"
    if mission.ends_at and now >= mission.ends_at:
        return "expired"
    if mission.capacity is not None:
        if taken_total is None:
            taken_total = _taken_total(mission)
        if taken_total >= mission.capacity:
            return "full"
    return None


def _check_can_take(customer: Customer, mission: Mission) -> Mission:
    """Checks the mission as it is now, locked (an admin's edit or the last free place cannot cross
    this try); returns that fresh copy."""
    mission = Mission.objects.select_for_update().get(pk=mission.pk)
    reason = unavailable(mission)
    if reason:
        raise MissionError(UNAVAILABLE[reason], reason)
    if _used(customer, mission) >= _limit(mission):
        if mission.repeat == Mission.Repeat.DAILY:
            raise MissionError("سهم امروزت از این مأموریت تمام شده؛ فردا دوباره بیا.", "done_today")
        raise MissionError("این مأموریت را قبلاً انجام داده‌ای.", "done")
    return mission


def _check_capacity(mission: Mission):
    mission = Mission.objects.select_for_update().get(pk=mission.pk)
    if mission.capacity is not None and _taken_total(mission) >= mission.capacity:
        raise MissionError(UNAVAILABLE["full"], "full")


def link_for(attempt: MissionAttempt) -> str:
    return (attempt.mission.link_url or "").replace("{click_id}", str(attempt.click_id))


# ── what the player sees ──


@dataclass
class View:
    mission: Mission
    state: str
    used: int
    limit: int
    attempt: MissionAttempt | None
    # This player's tries of the mission still waiting for review (any day), and the ones paid.
    pending: int = 0
    completed: int = 0


def listing(customer: Customer) -> list[View]:
    """The missions in the list, each with its state for this player."""
    now = timezone.now()
    today = ad_reward.today()
    missions = list(
        Mission.objects.filter(is_visible=True, category__is_active=True)
        .filter(Q(ends_at__isnull=True) | Q(ends_at__gt=now - SHOW_ENDED_FOR))
        .select_related("category")
    )
    ids = [m.pk for m in missions]
    mine = MissionAttempt.objects.filter(customer=customer, mission_id__in=ids)
    used_once = dict(
        mine.filter(status__in=TAKEN).values_list("mission_id").annotate(n=Count("id")).values_list("mission_id", "n")
    )
    used_today = dict(
        mine.filter(status__in=TAKEN, day=today)
        .values_list("mission_id")
        .annotate(n=Count("id"))
        .values_list("mission_id", "n")
    )
    pending = dict(
        mine.filter(status=Status.PENDING).values_list("mission_id").annotate(n=Count("id")).values_list("mission_id", "n")
    )
    completed = dict(
        mine.filter(status=Status.COMPLETED).values_list("mission_id").annotate(n=Count("id")).values_list("mission_id", "n")
    )
    latest = {
        a.mission_id: a
        for a in mine.order_by("mission_id", "-create_time").distinct("mission_id")
    }
    capped = [m.pk for m in missions if m.capacity is not None]
    taken = dict(
        MissionAttempt.objects.filter(mission_id__in=capped, status__in=TAKEN)
        .values_list("mission_id")
        .annotate(n=Count("id"))
        .values_list("mission_id", "n")
    )
    video = None
    views = []
    for m in missions:
        daily = m.repeat == Mission.Repeat.DAILY
        used = (used_today if daily else used_once).get(m.pk, 0)
        limit = _limit(m)
        last = latest.get(m.pk)
        reason = unavailable(m, now, taken.get(m.pk, 0))
        this_slot = last is not None and (not daily or last.day in (None, today))
        if last and last.status == Status.PENDING and this_slot and used >= limit:
            state = "pending"
        elif used >= limit:
            state = "done_today" if daily else "done"
        elif reason:
            state = reason
        elif m.kind == Mission.Kind.INTERSTITIAL and ad_reward.interstitial_creative() is None:
            state = "inactive"  # no full-screen placement set up
        elif m.kind == Mission.Kind.VIDEO and not (video := video or ad_reward.offer(customer)).available:
            # Every rewarded video of the day (before games too) counts against one limit.
            state = "done_today" if video.provider and video.remaining_today == 0 else "inactive"
        elif last and last.status == Status.STARTED:
            state = "waiting" if m.verification == Mission.Verification.CALLBACK else "in_progress"
        elif last and last.status == Status.REJECTED and this_slot:
            state = "rejected"
        else:
            state = "available"
        views.append(View(m, state, used, limit, last, pending.get(m.pk, 0), completed.get(m.pk, 0)))
    return views


# ── doing a mission ──


def start(customer: Customer, mission_id) -> MissionAttempt:
    """Starts (or continues) a try. A video gets its rewarded-ad session; a full-screen ad its
    placement (in the try's payload); the others get the link."""
    with transaction.atomic():
        _lock(customer)
        # Locked: an admin's edit of the mission (its kind) and a first start never cross.
        mission = Mission.objects.select_for_update().filter(pk=mission_id).exclude(kind=Mission.Kind.QR).first()
        if mission is None or not mission.is_visible:
            raise NotFound()
        mission = _check_can_take(customer, mission)
        if mission.kind == Mission.Kind.INTERSTITIAL and ad_reward.interstitial_creative() is None:
            raise MissionError("فعلاً تبلیغی برای این مأموریت نیست.", "inactive")
        if mission.kind != Mission.Kind.VIDEO:
            open_try = (
                MissionAttempt.objects.filter(customer=customer, mission=mission, status=Status.STARTED)
                .order_by("-create_time")
                .first()
            )
            if open_try:
                return open_try
        attempt = MissionAttempt.objects.create(customer=customer, mission=mission, points=mission.points)
        if mission.kind == Mission.Kind.VIDEO:
            try:
                attempt.ad_session = ad_reward.start(customer, f"mission:{mission.pk}", points=attempt.points)
            except ad_reward.AdRewardError as exc:
                raise MissionError(str(exc), "done_today") from exc
            attempt.save(update_fields=["ad_session", "update_time"])
        return attempt


def _locked_attempt(customer: Customer, attempt_id) -> MissionAttempt:
    attempt = (
        MissionAttempt.objects.select_for_update()
        .select_related("mission")
        .filter(pk=attempt_id, customer=customer)
        .first()
    )
    if attempt is None:
        raise NotFound("این مأموریت پیدا نشد.")
    return attempt


def _pay(attempt: MissionAttempt, tx: ActivityTransaction | None = None):
    """Marks the try done and pays its points (or records `tx`, a payment made elsewhere)."""
    now = timezone.now()
    mission = attempt.mission
    if tx is None:
        # The points reach the points wallet through the ActivityTransaction post_save signal.
        tx = ActivityTransaction.objects.create(
            customer=attempt.customer,
            section=SECTION,
            action_type=f"mission:{attempt.pk}",
            score_value=attempt.points,
            reward_data={"score": attempt.points},
            metadata={"mission": str(mission.pk), "title": mission.title, "kind": mission.kind},
            status=ActivityTransaction.Status.COMPLETED,
            description=f"Mission: {mission.title}"[:255],
        )
    attempt.activity_transaction = tx
    attempt.status = Status.COMPLETED
    attempt.completed_at = now
    attempt.day = attempt.day or ad_reward.today()
    attempt.save(update_fields=["activity_transaction", "status", "completed_at", "day", "update_time"])


@dataclass
class Claim:
    attempt: MissionAttempt
    already: bool


def claim(customer: Customer, attempt_id, evidence: dict | None = None) -> Claim:
    """The reward of a watched video, or of a banner opened long enough."""
    with transaction.atomic():
        _lock(customer)
        attempt = _locked_attempt(customer, attempt_id)
        if attempt.status == Status.COMPLETED:
            return Claim(attempt, already=True)
        mission = attempt.mission
        if attempt.status != Status.STARTED or mission.kind not in (Mission.Kind.VIDEO, Mission.Kind.BANNER, Mission.Kind.INTERSTITIAL):
            raise MissionError("این مأموریت این‌طور انجام نمی‌شود.")
        mission = _check_can_take(customer, mission)
        if mission.kind == Mission.Kind.VIDEO:
            if attempt.ad_session_id is None:
                raise MissionError("ویدیوی این مأموریت پیدا نشد؛ دوباره شروع کن.")
            try:
                result = ad_reward.complete(customer, attempt.ad_session_id, evidence, mission=True)
            except ad_reward.AdRewardError as exc:
                raise MissionError(str(exc), exc.code) from exc
            _pay(attempt, result.session.activity_transaction)
        else:
            # A banner (its link opened) or a full-screen ad (shown): paid after the mission's wait.
            if attempt.opened_at is None:
                raise MissionError(
                    "اول تبلیغ را ببین." if mission.kind == Mission.Kind.INTERSTITIAL else "اول بنر را باز کن.", "not_opened"
                )
            wait = mission.min_seconds - (timezone.now() - attempt.opened_at).total_seconds()
            if wait > 0:
                raise MissionError(f"{int(wait) + 1} ثانیهٔ دیگر امتیاز را بگیر.", "too_soon")
            _pay(attempt)
        return Claim(attempt, already=False)


def mark_opened(customer: Customer, attempt_id) -> MissionAttempt:
    """The player opened the try's link (the banner's wait starts at the first opening)."""
    with transaction.atomic():
        attempt = _locked_attempt(customer, attempt_id)
        if attempt.status == Status.STARTED and attempt.opened_at is None:
            attempt.opened_at = timezone.now()
            attempt.save(update_fields=["opened_at", "update_time"])
        return attempt


def _check_image(image):
    """A real JPEG / PNG / WEBP; its stored name takes the extension of what it really is (never
    the name the phone sent), so it is always served as an image."""
    from PIL import Image, UnidentifiedImageError  # pylint: disable=import-outside-toplevel

    if image.size > PROOF_MAX_BYTES:
        raise MissionError("حجم تصویر باید کمتر از ۵ مگابایت باشد.")
    try:
        with Image.open(image) as picture:
            kind = picture.format
            picture.verify()
    except (UnidentifiedImageError, OSError, ValueError, SyntaxError, Image.DecompressionBombError) as exc:
        raise MissionError("این فایل تصویر نیست.") from exc
    if kind not in PROOF_FORMATS:
        raise MissionError("تصویر باید JPG، PNG یا WEBP باشد.")
    image.seek(0)
    image.name = f"proof.{PROOF_FORMATS[kind]}"


def submit_proof(customer: Customer, attempt_id, text: str = "", image=None) -> MissionAttempt:
    """Sends a try for review (the admin approves or rejects it)."""
    text = (text or "").strip()
    with transaction.atomic():
        _lock(customer)
        attempt = _locked_attempt(customer, attempt_id)
        mission = attempt.mission
        if mission.verification != Mission.Verification.REVIEW:
            raise MissionError("این مأموریت مدرک لازم ندارد.")
        if attempt.status == Status.PENDING:
            raise MissionError("مدرک این مأموریت فرستاده شده و در انتظار بررسی است.", "pending")
        if attempt.status != Status.STARTED:
            raise MissionError("این مأموریت را دوباره شروع کن.")
        if mission.proof_label and not text:
            raise MissionError(f"{mission.proof_label} را بنویس.")
        if len(text) > 200:
            raise MissionError("متن مدرک خیلی طولانی است.")
        if mission.proof_image_required and not image:
            raise MissionError("اسکرین‌شات را هم بفرست.")
        if not mission.proof_label and not mission.proof_image_required and not text and not image:
            raise MissionError("یک توضیح یا اسکرین‌شات بفرست.")
        if image:
            _check_image(image)
        mission = _check_can_take(customer, mission)
        attempt.proof_text = text
        if image:
            attempt.proof_image = image
        attempt.status = Status.PENDING
        attempt.day = ad_reward.today()
        attempt.submitted_at = timezone.now()
        attempt.save()
        return attempt


# ── a place's QR ──
# A printed QR carries the mission's token for good. A venue screen (qr_rotating) shows a new code
# every QR_STEP seconds: "<token>~r<start>~<signature>", accepted until QR_GRACE seconds after its
# step ends, so a photo of it sent on later is refused. Scanned while signed out, a valid code is
# exchanged for a hold ("<token>~h<time>~<signature>") that outlives the sign-in (QR_HOLD).
QR_STEP = 30
QR_GRACE = 120
QR_HOLD = 15 * 60
QR_EXPIRED = "این QR منقضی شده؛ دوباره از روی نمایشگرِ محل اسکن کن."


def _qr_signature(owner: "Mission | MysteryStep", kind: str, at: int) -> str:
    # A mission's codes and a mystery step's never stand for each other.
    prefix = "mystery-qr" if isinstance(owner, MysteryStep) else "mission-qr"
    message = f"{prefix}:{owner.pk}:{owner.qr_token}:{kind}:{at}".encode()
    return hmac.new(settings.SECRET_KEY.encode(), message, hashlib.sha256).hexdigest()[:20]


def display_code(mission: "Mission | MysteryStep", now: float | None = None) -> tuple[str, int]:
    """The code a venue screen shows now, and the seconds until the next one."""
    now = time.time() if now is None else now
    start = int(now) // QR_STEP * QR_STEP
    return f"{mission.qr_token}~r{start}~{_qr_signature(mission, 'r', start)}", max(1, start + QR_STEP - int(now))


def _split_code(code: str) -> tuple[str, str | None, int | None, str | None]:
    """(token, kind, time, signature); a printed QR's code is the bare token."""
    code = code or ""
    if len(code) > 120:  # a token (24) + a time (~11) + a signature (20): anything longer is not ours
        return "", None, None, None
    parts = code.split("~")
    if len(parts) == 1:
        return parts[0], None, None, None
    stamp = parts[1][1:] if len(parts) == 3 else ""
    # ASCII digits only, of a sane length: str.isdigit() also takes «²» and other digits int() refuses.
    if len(parts) == 3 and parts[1][:1] in ("r", "h") and 0 < len(stamp) <= 12 and stamp.isascii() and stamp.isdigit():
        return parts[0], parts[1][0], int(stamp), parts[2]
    return "", None, None, None


def _code_valid(mission: "Mission | MysteryStep", kind: str | None, at: int | None, signature: str | None, now: float) -> bool:
    if kind is None or at is None or not signature:
        return False
    try:
        given = signature.encode("ascii")
    except UnicodeEncodeError:
        return False
    if not hmac.compare_digest(given, _qr_signature(mission, kind, at).encode()):
        return False
    lasts = QR_STEP + QR_GRACE if kind == "r" else QR_HOLD
    return at - 5 <= now <= at + lasts  # (a few seconds of clock difference allowed)


def qr_owner(code: str, lock: bool = False) -> tuple["Mission | MysteryStep", str | None, int | None, str | None]:
    """The QR mission, or the «معمای شهری» step, a scanned code is for; refused when it is not a
    valid code (a venue screen's must still be fresh). `lock` locks a mission's row."""
    token, kind, at, signature = _split_code(code)
    owner = None
    if token:
        missions = Mission.objects.select_for_update() if lock else Mission.objects
        owner = missions.filter(qr_token=token, kind=Mission.Kind.QR).first()
        if owner is None:
            owner = MysteryStep.objects.filter(qr_token=token, proof=MysteryStep.Proof.QR).first()
    # A venue-screen code takes only its fresh codes; a printed one only its token.
    if owner is None or (kind is not None and not owner.qr_rotating):
        raise NotFound("این کد QR معتبر نیست.")
    if owner.qr_rotating and not _code_valid(owner, kind, at, signature, time.time()):
        raise MissionError(QR_EXPIRED, "qr_expired")
    return owner, kind, at, signature


def is_mystery_code(code: str) -> bool:
    token = _split_code(code)[0]
    return bool(token) and MysteryStep.objects.filter(qr_token=token).exists()


def _qr_mission(code: str, lock: bool = False) -> tuple[Mission, str | None, int | None, str | None]:
    found = qr_owner(code, lock)
    if not isinstance(found[0], Mission):
        raise NotFound("این کد QR معتبر نیست.")
    return found


def hold_qr(code: str) -> str:
    """A fresh venue-screen code scanned while signed out: a hold that lasts through the sign-in."""
    owner, kind, _at, _signature = qr_owner(code)
    if not owner.qr_rotating or kind != "r":
        return code  # a printed QR's token keeps as it is
    now = int(time.time())
    return f"{owner.qr_token}~h{now}~{_qr_signature(owner, 'h', now)}"


def venue_display(key: str) -> tuple["Mission | MysteryStep", str, int, float]:
    """The screen's code now, the whole seconds until the next one, and the exact seconds the shown
    code is still accepted (the screen hides it before then). The screen is a QR mission's or a
    mystery step's."""
    mission = (
        Mission.objects.filter(qr_display_key=key, kind=Mission.Kind.QR, qr_rotating=True).first() if key else None
    )
    if mission is None and key:
        mission = (
            MysteryStep.objects.filter(qr_display_key=key, proof=MysteryStep.Proof.QR, qr_rotating=True)
            .select_related("mystery")
            .first()
        )
    if mission is None:
        raise NotFound()
    now = time.time()
    code, expires_in = display_code(mission, now)
    start = int(now) // QR_STEP * QR_STEP
    return mission, code, expires_in, round(start + QR_STEP + QR_GRACE - now, 3)


def claim_qr(customer: Customer, token: str):
    """A QR at a place, scanned with the phone's camera (its link opens the app). A mystery step's QR
    gives the mystery's Result instead of a Claim."""
    if is_mystery_code(token):
        from apps.missions import mystery  # pylint: disable=import-outside-toplevel

        return mystery.scan(customer, token)
    with transaction.atomic():
        _lock(customer)
        # Locked like start(): an admin's edit of the mission cannot cross the scan.
        mission = _qr_mission(token, lock=True)[0]
        done_today = (
            MissionAttempt.objects.filter(customer=customer, mission=mission, status=Status.COMPLETED)
            .order_by("-completed_at")
            .first()
        )
        try:
            mission = _check_can_take(customer, mission)
        except MissionError as exc:
            if exc.code in ("done", "done_today") and done_today:
                return Claim(done_today, already=True)
            raise
        attempt = MissionAttempt.objects.create(customer=customer, mission=mission, points=mission.points)
        _pay(attempt)
        return Claim(attempt, already=False)


def partner_callback(mission_id, click_id, secret: str) -> Claim:
    """The partner's server says the player signed up / installed: paid without review."""
    try:
        click_id = uuid.UUID(str(click_id))
    except ValueError as exc:
        raise MissionError("click_id نامعتبر است.") from exc
    mission = Mission.objects.filter(pk=mission_id, verification=Mission.Verification.CALLBACK).first()
    if mission is None or not mission.callback_secret:
        raise NotFound()
    try:
        given = str(secret or "").encode()
    except UnicodeEncodeError:
        given = b""
    if not given or not hmac.compare_digest(given, mission.callback_secret.encode()):
        raise MissionError("کلید نادرست است.", "forbidden")
    attempt = MissionAttempt.objects.filter(mission=mission, click_id=click_id).select_related("customer").first()
    if attempt is None:
        raise NotFound("این کلیک پیدا نشد.")
    with transaction.atomic():
        _lock(attempt.customer)
        attempt = _locked_attempt(attempt.customer, attempt.pk)
        if attempt.status == Status.COMPLETED:
            return Claim(attempt, already=True)
        if attempt.status != Status.STARTED:
            raise MissionError("این کلیک قابل تأیید نیست.", "conflict")
        # Started while the mission was open: the partner's word still counts if it has ended
        # since (a sign-up can take a while); the player's limit still holds.
        mission = attempt.mission  # as read under the lock (a capacity changed meanwhile counts)
        if _used(attempt.customer, mission) >= _limit(mission):
            raise MissionError("سهم این بازیکن از این مأموریت پر شده است.", "conflict")
        _check_capacity(mission)
        _pay(attempt)
    _notify_paid(attempt)
    return Claim(attempt, already=False)


# ── review (admin) ──


def _notify(attempt: MissionAttempt, title: str, body: str):
    from apps.notifications import services as notifications  # pylint: disable=import-outside-toplevel

    try:
        notifications.queue(attempt.customer, "account", title, body, url="/pwa/earn")
    except Exception:  # pylint: disable=broad-except
        pass  # a notification is a courtesy: never the reason a review fails


def _notify_paid(attempt: MissionAttempt):
    _notify(attempt, "امتیاز مأموریت رسید", f"«{attempt.mission.title}» تأیید شد: {attempt.points} امتیاز.")


def approve(attempt_id, by=None) -> bool:
    """Pays a try waiting for review. False when it was not waiting (already reviewed)."""
    with transaction.atomic():
        attempt = MissionAttempt.objects.filter(pk=attempt_id).select_related("customer").first()
        if attempt is None:
            return False
        _lock(attempt.customer)
        attempt = _locked_attempt(attempt.customer, attempt.pk)
        if attempt.status != Status.PENDING:
            return False
        attempt.reviewed_at = timezone.now()
        attempt.reviewed_by = by
        attempt.save(update_fields=["reviewed_at", "reviewed_by", "update_time"])
        _pay(attempt)
    _notify_paid(attempt)
    return True


def reject(attempt_id, by=None, note: str = "") -> bool:
    with transaction.atomic():
        attempt = MissionAttempt.objects.filter(pk=attempt_id).select_related("customer").first()
        if attempt is None:
            return False
        _lock(attempt.customer)  # the player first, then the try: the same order as approve()
        attempt = _locked_attempt(attempt.customer, attempt.pk)
        if attempt.status != Status.PENDING:
            return False
        attempt.status = Status.REJECTED
        attempt.review_note = (note or attempt.review_note or "مدرک فرستاده‌شده کافی نبود.")[:300]
        attempt.reviewed_at = timezone.now()
        attempt.reviewed_by = by
        attempt.save(update_fields=["status", "review_note", "reviewed_at", "reviewed_by", "update_time"])
    _notify(attempt, "مأموریت تأیید نشد", f"«{attempt.mission.title}»: {attempt.review_note}")
    return True
