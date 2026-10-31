"""Missions: what a player can do now, starting a try, and paying it.

Every payment goes through `_pay` (one ActivityTransaction per completed try, unique by its id), or
for a video through the rewarded-ad service, which pays its own transaction. Changes of a player's
tries happen under a lock on the player (as the rewarded ad does), so two requests at the same moment
cannot both use the last free try of the day.
"""

import hmac
import uuid
from dataclasses import dataclass
from datetime import timedelta

from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone

from apps.missions.models import Mission, MissionAttempt
from apps.users.models.customer import Customer
from apps.wallet.models.transactions.activity import ActivityTransaction
from apps.wallet.services import ad_reward

SECTION = "mission"
# A mission that has ended stays in the list (as «پایان‌یافته») this long.
SHOW_ENDED_FOR = timedelta(days=14)
PROOF_MAX_BYTES = 5 * 1024 * 1024
PROOF_FORMATS = {"JPEG", "PNG", "WEBP"}

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
        q = q.filter(day=timezone.localdate())
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


def _check_can_take(customer: Customer, mission: Mission):
    reason = unavailable(mission)
    if reason:
        raise MissionError(UNAVAILABLE[reason], reason)
    if _used(customer, mission) >= _limit(mission):
        if mission.repeat == Mission.Repeat.DAILY:
            raise MissionError("سهم امروزت از این مأموریت تمام شده؛ فردا دوباره بیا.", "done_today")
        raise MissionError("این مأموریت را قبلاً انجام داده‌ای.", "done")


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


def listing(customer: Customer) -> list[View]:
    """The missions in the list, each with its state for this player."""
    now = timezone.now()
    today = timezone.localdate()
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
        if last and last.status == Status.PENDING and this_slot:
            state = "pending"
        elif used >= limit:
            state = "done_today" if daily else "done"
        elif reason:
            state = reason
        elif m.kind == Mission.Kind.VIDEO and not (video := video or ad_reward.offer(customer)).available:
            # Every rewarded video of the day (before games too) counts against one limit.
            state = "done_today" if video.provider and video.remaining_today == 0 else "inactive"
        elif last and last.status == Status.STARTED:
            state = "waiting" if m.verification == Mission.Verification.CALLBACK else "in_progress"
        elif last and last.status == Status.REJECTED and this_slot:
            state = "rejected"
        else:
            state = "available"
        views.append(View(m, state, used, limit, last))
    return views


# ── doing a mission ──


def start(customer: Customer, mission_id) -> MissionAttempt:
    """Starts (or continues) a try. A video gets its rewarded-ad session; the others get the link."""
    with transaction.atomic():
        _lock(customer)
        mission = Mission.objects.filter(pk=mission_id).exclude(kind=Mission.Kind.QR).first()
        if mission is None or not mission.is_visible:
            raise NotFound()
        _check_can_take(customer, mission)
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
    attempt.day = attempt.day or timezone.localdate()
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
        if attempt.status != Status.STARTED or mission.kind not in (Mission.Kind.VIDEO, Mission.Kind.BANNER):
            raise MissionError("این مأموریت این‌طور انجام نمی‌شود.")
        _check_can_take(customer, mission)
        if mission.kind == Mission.Kind.VIDEO:
            if attempt.ad_session_id is None:
                raise MissionError("ویدیوی این مأموریت پیدا نشد؛ دوباره شروع کن.")
            try:
                result = ad_reward.complete(customer, attempt.ad_session_id, evidence)
            except ad_reward.AdRewardError as exc:
                raise MissionError(str(exc)) from exc
            _pay(attempt, result.session.activity_transaction)
        else:
            wait = mission.min_seconds - (timezone.now() - attempt.create_time).total_seconds()
            if wait > 0:
                raise MissionError(f"{int(wait) + 1} ثانیهٔ دیگر امتیاز را بگیر.", "too_soon")
            _pay(attempt)
        return Claim(attempt, already=False)


def _check_image(image):
    from PIL import Image, UnidentifiedImageError  # pylint: disable=import-outside-toplevel

    if image.size > PROOF_MAX_BYTES:
        raise MissionError("حجم تصویر باید کمتر از ۵ مگابایت باشد.")
    try:
        with Image.open(image) as picture:
            kind = picture.format
            picture.verify()
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError) as exc:
        raise MissionError("این فایل تصویر نیست.") from exc
    if kind not in PROOF_FORMATS:
        raise MissionError("تصویر باید JPG، PNG یا WEBP باشد.")
    image.seek(0)


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
        _check_can_take(customer, mission)
        attempt.proof_text = text
        if image:
            attempt.proof_image = image
        attempt.status = Status.PENDING
        attempt.day = timezone.localdate()
        attempt.submitted_at = timezone.now()
        attempt.save()
        return attempt


def claim_qr(customer: Customer, token: str) -> Claim:
    """A QR at a place, scanned with the phone's camera (its link opens the app)."""
    with transaction.atomic():
        _lock(customer)
        mission = Mission.objects.filter(qr_token=token, kind=Mission.Kind.QR).first() if token else None
        if mission is None:
            raise NotFound("این کد QR معتبر نیست.")
        done_today = (
            MissionAttempt.objects.filter(customer=customer, mission=mission, status=Status.COMPLETED)
            .order_by("-completed_at")
            .first()
        )
        try:
            _check_can_take(customer, mission)
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
    if not hmac.compare_digest(str(secret or ""), mission.callback_secret):
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
        if _used(attempt.customer, mission) >= _limit(mission):
            raise MissionError("سهم این بازیکن از این مأموریت پر شده است.", "conflict")
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
        attempt = MissionAttempt.objects.select_for_update().select_related("mission", "customer").filter(pk=attempt_id).first()
        if attempt is None or attempt.status != Status.PENDING:
            return False
        attempt.status = Status.REJECTED
        attempt.review_note = (note or attempt.review_note or "مدرک فرستاده‌شده کافی نبود.")[:300]
        attempt.reviewed_at = timezone.now()
        attempt.reviewed_by = by
        attempt.save(update_fields=["status", "review_note", "reviewed_at", "reviewed_by", "update_time"])
    _notify(attempt, "مأموریت تأیید نشد", f"«{attempt.mission.title}»: {attempt.review_note}")
    return True
