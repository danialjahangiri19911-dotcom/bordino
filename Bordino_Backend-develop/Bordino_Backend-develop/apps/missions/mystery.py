"""«معمای شهری»: starting a mystery, proving a step at its place, and paying it.

A player's progress is the set of steps they have checked in at (MysteryCheckin): the current step is
the first step, in order, without one, so an admin may add or reorder the steps of a running mystery.
Everything that changes a player's game happens under the lock on the player (as missions do), then
the mystery's row: two phones of one player cannot both solve the same step.
"""

import math
import unicodedata
from dataclasses import dataclass
from datetime import timedelta

from django.db import transaction
from django.db.models import Count, Max, Min, Q, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone

from apps.missions.models import Mystery, MysteryCheckin, MysteryRun, MysteryStep
from apps.missions.services import SECTION, SHOW_ENDED_FOR, MissionError, NotFound, _lock
from apps.users.models.customer import Customer
from apps.wallet.models.transactions.activity import ActivityTransaction
from apps.wallet.services.ad_reward import DAY_ZONE

Proof = MysteryStep.Proof
RunStatus = MysteryRun.Status

# Wrong answers / staff codes in a row at one step before a wait: guessing by trying many is slow.
WRONG_LIMIT = 5
WRONG_WAIT = timedelta(minutes=10)
# A location less precise than this proves nothing (an indoor phone with no GPS fix says ~1–3 km).
MAX_ACCURACY_M = 300

UNAVAILABLE = {
    "inactive": "این معما فعلاً غیرفعال است.",
    "upcoming": "این معما هنوز شروع نشده است.",
    "expired": "زمان این معما تمام شده است.",
    "full": "ظرفیت این معما تکمیل شده است.",
    "empty": "این معما هنوز آماده نیست.",
}


def not_found():
    return NotFound("این معما پیدا نشد.")


def unavailable(mystery: Mystery, now=None, started: int | None = None, steps: int | None = None) -> str | None:
    """Why a new player cannot start the mystery now, or None. (`full` does not stop those already
    playing; the rest do.)"""
    now = now or timezone.now()
    if not mystery.is_active:
        return "inactive"
    if mystery.starts_at and now < mystery.starts_at:
        return "upcoming"
    if mystery.ends_at and now >= mystery.ends_at:
        return "expired"
    if (steps if steps is not None else mystery.steps.count()) == 0:
        return "empty"
    if mystery.capacity is not None:
        if started is None:
            started = mystery.runs.count()
        if started >= mystery.capacity:
            return "full"
    return None


def steps_of(mystery: Mystery) -> list[MysteryStep]:
    return list(mystery.steps.order_by("order", "create_time"))


def current_step(steps: list[MysteryStep], done: set) -> MysteryStep | None:
    return next((s for s in steps if s.pk not in done), None)


# ── what the player sees ──


@dataclass
class View:
    mystery: Mystery
    state: str
    steps: int
    done: int
    points: int  # all the steps' points and the finish bonus
    run: MysteryRun | None


def listing(customer: Customer) -> list[View]:
    """The mysteries in «دریافت امتیاز», each with this player's progress."""
    now = timezone.now()
    mysteries = list(
        Mystery.objects.filter(is_visible=True).filter(Q(ends_at__isnull=True) | Q(ends_at__gt=now - SHOW_ENDED_FOR))
    )
    if not mysteries:
        return []
    ids = [m.pk for m in mysteries]

    def per_mystery(qs, field, value):
        return dict(qs.values_list(field).annotate(n=value).values_list(field, "n"))

    n_steps = per_mystery(MysteryStep.objects.filter(mystery_id__in=ids), "mystery_id", Count("id"))
    step_points = per_mystery(MysteryStep.objects.filter(mystery_id__in=ids), "mystery_id", Sum("points"))
    n_runs = per_mystery(MysteryRun.objects.filter(mystery_id__in=ids), "mystery_id", Count("id"))
    runs = {r.mystery_id: r for r in MysteryRun.objects.filter(customer=customer, mystery_id__in=ids)}
    done = per_mystery(MysteryCheckin.objects.filter(run__in=runs.values()), "run__mystery_id", Count("id"))
    views = []
    for m in mysteries:
        run = runs.get(m.pk)
        reason = unavailable(m, now, n_runs.get(m.pk, 0), n_steps.get(m.pk, 0))
        if run and run.status == RunStatus.COMPLETED:
            state = "done"
        elif run and reason not in (None, "full"):
            state = reason
        elif run:
            state = "in_progress"
        else:
            state = reason or "available"
        views.append(View(m, state, n_steps.get(m.pk, 0), done.get(m.pk, 0), (step_points.get(m.pk) or 0) + m.finish_points, run))
    return views


def view_of(customer: Customer, mystery_id) -> View:
    for view in listing(customer):
        if str(view.mystery.pk) == str(mystery_id):
            return view
    # Hidden from the list but being played (or finished): still shown to its player.
    mystery = Mystery.objects.filter(pk=mystery_id).annotate(n_steps=Count("steps", distinct=True)).first()
    run = MysteryRun.objects.filter(customer=customer, mystery=mystery).first() if mystery else None
    if run is None:
        raise not_found()
    reason = unavailable(mystery, steps=mystery.n_steps, started=0)
    state = "done" if run.status == RunStatus.COMPLETED else (reason or "in_progress")
    total = sum(s.points for s in mystery.steps.all()) + mystery.finish_points
    return View(mystery, state, mystery.n_steps, run.checkins.count(), total, run)


# ── playing ──


def start(customer: Customer, mystery_id) -> MysteryRun:
    """Starts the player's game (or returns the one they have)."""
    with transaction.atomic():
        _lock(customer)
        # Locked: the last free place goes to one player only.
        mystery = Mystery.objects.select_for_update().filter(pk=mystery_id).first()
        if mystery is None:
            raise not_found()
        run = MysteryRun.objects.filter(customer=customer, mystery=mystery).first()
        if run:
            return run
        if not mystery.is_visible:
            raise not_found()
        reason = unavailable(mystery)
        if reason:
            raise MissionError(UNAVAILABLE[reason], reason)
        return MysteryRun.objects.create(customer=customer, mystery=mystery)


@dataclass
class Result:
    run: MysteryRun
    step: MysteryStep
    already: bool
    points: int = 0  # this step's
    bonus: int = 0  # the finish bonus, when this step finished the mystery

    @property
    def finished(self) -> bool:
        return self.run.status == RunStatus.COMPLETED


def _check_open(mystery: Mystery):
    """A running game can go on unless the mystery was switched off or has ended."""
    now = timezone.now()
    if not mystery.is_active:
        raise MissionError(UNAVAILABLE["inactive"], "inactive")
    if mystery.ends_at and now >= mystery.ends_at:
        raise MissionError(UNAVAILABLE["expired"], "expired")
    if mystery.starts_at and now < mystery.starts_at:
        raise MissionError(UNAVAILABLE["upcoming"], "upcoming")


def distance_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in metres."""
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * 6_371_000 * math.asin(min(1.0, math.sqrt(a)))


def _number(value) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def check_location(step: MysteryStep, data: dict) -> tuple[int, int]:
    """The phone is at the place: (distance, accuracy) in metres; refused otherwise."""
    lat, lng, accuracy = _number(data.get("lat")), _number(data.get("lng")), _number(data.get("accuracy"))
    if lat is None or lng is None or not -90 <= lat <= 90 or not -180 <= lng <= 180:
        raise MissionError("موقعیت گوشی نرسید؛ اجازهٔ موقعیت مکانی را بده و دوباره بزن.", "location_needed")
    accuracy = max(0.0, accuracy if accuracy is not None else MAX_ACCURACY_M + 1)
    if accuracy > MAX_ACCURACY_M:
        raise MissionError(
            "موقعیت گوشی دقیق نیست؛ GPS را روشن کن، چند لحظه در فضای باز بایست و دوباره بزن.", "location_inaccurate"
        )
    distance = distance_m(lat, lng, float(step.latitude), float(step.longitude))
    # A reading is a circle of `accuracy` metres: it counts when that circle reaches the place's,
    # with at most the place's own radius of slack (a vague reading does not widen it further).
    if distance > step.radius_m + min(accuracy, step.radius_m):
        if distance <= step.radius_m * 4:
            raise MissionError("خیلی نزدیکی! چند قدم دیگر بگرد و دوباره بزن.", "too_far")
        raise MissionError("هنوز به محل نرسیده‌ای؛ سرنخ را دوباره بخوان.", "too_far")
    return round(distance), round(accuracy)


_DIGITS = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")
_LETTERS = str.maketrans({"ي": "ی", "ى": "ی", "ئ": "ی", "ك": "ک", "ۀ": "ه", "ة": "ه", "أ": "ا", "إ": "ا", "آ": "ا", "ؤ": "و"})


def normalize(text: str) -> str:
    """For comparing answers: no spaces, marks or punctuation; one form of each Persian letter and digit."""
    text = unicodedata.normalize("NFKC", str(text or "")).translate(_DIGITS).translate(_LETTERS).casefold()
    return "".join(ch for ch in text if ch.isalnum() and ch != "ـ")


def _matches(step: MysteryStep, given: str) -> bool:
    given = normalize(given)
    return bool(given) and any(given == normalize(a) for a in step.answer_list())


def _pay(run: MysteryRun, step: MysteryStep, method: str, distance=None, accuracy=None) -> Result:
    """Records the visit, pays the step (and the finish bonus after the last step)."""
    mystery = run.mystery
    checkin = MysteryCheckin.objects.create(
        run=run, step=step, customer=run.customer, method=method, points=step.points, distance_m=distance, accuracy_m=accuracy
    )
    if step.points:
        # The points reach the points wallet through the ActivityTransaction post_save signal.
        checkin.activity_transaction = ActivityTransaction.objects.create(
            customer=run.customer,
            section=SECTION,
            action_type=f"mystery-step:{checkin.pk}",
            score_value=step.points,
            reward_data={"score": step.points},
            metadata={"mystery": str(mystery.pk), "step": str(step.pk), "title": f"معمای «{mystery.title}» — {step.place_name}"},
            status=ActivityTransaction.Status.COMPLETED,
            description=f"Mystery: {mystery.title} / {step.place_name}"[:255],
        )
        checkin.save(update_fields=["activity_transaction", "update_time"])
    run.points_earned += step.points
    run.wrong_tries = 0
    run.locked_until = None
    result = Result(run, step, already=False, points=step.points)
    done = set(run.checkins.values_list("step_id", flat=True))
    if current_step(steps_of(mystery), done) is None:
        run.status = RunStatus.COMPLETED
        run.completed_at = timezone.now()
        if mystery.finish_points:
            run.finish_transaction = ActivityTransaction.objects.create(
                customer=run.customer,
                section=SECTION,
                action_type=f"mystery:{run.pk}",
                score_value=mystery.finish_points,
                reward_data={"score": mystery.finish_points},
                metadata={"mystery": str(mystery.pk), "title": f"پایان معمای «{mystery.title}»"},
                status=ActivityTransaction.Status.COMPLETED,
                description=f"Mystery finished: {mystery.title}"[:255],
            )
            run.points_earned += mystery.finish_points
            result.bonus = mystery.finish_points
    run.save()
    return result


def _locked_run(customer: Customer, mystery: Mystery) -> MysteryRun | None:
    return MysteryRun.objects.select_for_update().select_related("mystery").filter(customer=customer, mystery=mystery).first()


def _step_for(run: MysteryRun, step: MysteryStep, steps: list[MysteryStep]) -> Result | None:
    """None when `step` is the one to solve now; a Result when it was solved before; refused otherwise."""
    done = set(run.checkins.values_list("step_id", flat=True))
    if step.pk in done:
        return Result(run, step, already=True)
    if run.status == RunStatus.COMPLETED:
        return Result(run, step, already=True)
    current = current_step(steps, done)
    if current is None or current.pk != step.pk:
        number = next((i for i, s in enumerate(steps, 1) if current and s.pk == current.pk), None)
        raise MissionError(
            f"این مکانِ مرحله‌های بعدیِ معماست؛ اول سرنخ مرحلهٔ {number} را حل کن." if number else "این مرحله الان باز نیست.",
            "not_current",
        )
    return None


def checkin(customer: Customer, mystery_id, step_id, data: dict) -> Result:
    """The player proves the current step with its answer, the staff's code, or the phone's location."""
    data = data if isinstance(data, dict) else {}
    refusal = None
    with transaction.atomic():
        _lock(customer)
        mystery = Mystery.objects.select_for_update().filter(pk=mystery_id).first()
        if mystery is None:
            raise not_found()
        run = _locked_run(customer, mystery)
        if run is None:
            raise MissionError("اول معما را شروع کن.", "not_started")
        steps = steps_of(mystery)
        step = next((s for s in steps if str(s.pk) == str(step_id)), None)
        if step is None:
            raise NotFound("این مرحله پیدا نشد.")
        solved = _step_for(run, step, steps)
        if solved:
            return solved
        _check_open(mystery)
        now = timezone.now()
        if run.locked_until and run.locked_until > now:
            minutes = max(1, math.ceil((run.locked_until - now).total_seconds() / 60))
            raise MissionError(f"چند بار اشتباه شد؛ {minutes} دقیقهٔ دیگر دوباره امتحان کن.", "locked")
        if step.proof == Proof.QR:
            raise MissionError("این مرحله با اسکن QR محل تأیید می‌شود.", "use_qr")
        distance = accuracy = None
        if step.proof == Proof.GPS or step.check_location:
            distance, accuracy = check_location(step, data)
        if step.proof == Proof.GPS:
            return _pay(run, step, step.proof, distance, accuracy)
        given = str(data.get("code" if step.proof == Proof.STAFF else "answer") or "")[:100]
        if not normalize(given):
            raise MissionError("کد کارکنان را بنویس." if step.proof == Proof.STAFF else "پاسخ را بنویس.", "invalid")
        if _matches(step, given):
            return _pay(run, step, step.proof, distance, accuracy)
        # Wrong: counted (kept, the error is raised after the commit).
        run.wrong_tries += 1
        noun = "کد" if step.proof == Proof.STAFF else "پاسخ"
        if run.wrong_tries >= WRONG_LIMIT:
            run.wrong_tries = 0
            run.locked_until = now + WRONG_WAIT
            minutes = int(WRONG_WAIT.total_seconds() // 60)
            refusal = MissionError(f"{noun} درست نیست. چند بار اشتباه شد؛ {minutes} دقیقهٔ دیگر دوباره امتحان کن.", "locked")
        else:
            left = WRONG_LIMIT - run.wrong_tries
            refusal = MissionError(f"{noun} درست نیست؛ {left} بار دیگر می‌توانی امتحان کنی.", "wrong")
        run.save(update_fields=["wrong_tries", "locked_until", "update_time"])
    raise refusal


def scan(customer: Customer, code: str) -> Result:
    """A step's QR (printed, or the place's venue screen) scanned by the player. Scanning the first
    step's QR starts the mystery: a poster at the first place can be the way in."""
    from apps.missions import services  # pylint: disable=import-outside-toplevel

    with transaction.atomic():
        _lock(customer)
        step = services.qr_owner(code)[0]
        if not isinstance(step, MysteryStep):
            raise NotFound("این کد QR معتبر نیست.")
        mystery = Mystery.objects.select_for_update().get(pk=step.mystery_id)
        steps = steps_of(mystery)
        step = next((s for s in steps if s.pk == step.pk), step)
        run = _locked_run(customer, mystery)
        if run is None:
            if not steps or steps[0].pk != step.pk:
                raise MissionError(f"این QR مال معمای «{mystery.title}» است؛ اول معما را از «دریافت امتیاز» شروع کن.", "not_started")
            # (A mystery hidden from the list starts this way too: a poster-only hunt.)
            reason = unavailable(mystery, steps=len(steps))
            if reason:
                raise MissionError(UNAVAILABLE[reason], reason)
            run = MysteryRun.objects.create(customer=customer, mystery=mystery)
            run.mystery = mystery
        solved = _step_for(run, step, steps)
        if solved:
            return solved
        _check_open(mystery)
        return _pay(run, step, Proof.QR)


# ── the admin's report ──


def report(mystery: Mystery) -> dict:
    """Visits per place (all, last 7 and 30 days, first and last), the players' progress, and the
    visits per place for each of the last 14 days."""
    now = timezone.now()
    steps = steps_of(mystery)
    rows = {
        r["step_id"]: r
        for r in MysteryCheckin.objects.filter(step__mystery=mystery)
        .values("step_id")
        .annotate(
            total=Count("id"),
            week=Count("id", filter=Q(create_time__gte=now - timedelta(days=7))),
            month=Count("id", filter=Q(create_time__gte=now - timedelta(days=30))),
            first=Min("create_time"),
            last=Max("create_time"),
        )
    }
    since = (timezone.localtime(now, timezone=DAY_ZONE) - timedelta(days=13)).replace(hour=0, minute=0, second=0, microsecond=0)
    days = [(since + timedelta(days=i)).date() for i in range(14)]
    daily = {}
    for r in (
        MysteryCheckin.objects.filter(step__mystery=mystery, create_time__gte=since)
        .annotate(day=TruncDate("create_time", tzinfo=DAY_ZONE))
        .values("step_id", "day")
        .annotate(n=Count("id"))
    ):
        daily[(r["step_id"], r["day"])] = r["n"]
    runs = mystery.runs.aggregate(
        started=Count("id"), completed=Count("id", filter=Q(status=RunStatus.COMPLETED))
    )
    return {
        "steps": [
            {
                "step": s,
                "total": rows.get(s.pk, {}).get("total", 0),
                "week": rows.get(s.pk, {}).get("week", 0),
                "month": rows.get(s.pk, {}).get("month", 0),
                "first": rows.get(s.pk, {}).get("first"),
                "last": rows.get(s.pk, {}).get("last"),
                "daily": [daily.get((s.pk, d), 0) for d in days],
            }
            for s in steps
        ],
        "days": days,
        "started": runs["started"],
        "completed": runs["completed"],
    }
