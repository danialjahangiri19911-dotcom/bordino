"""«معمای شهری»: starting a mystery, proving a step at its place, and paying it.

A player's progress is the set of steps they have checked in at (MysteryCheckin): the current step is
the first step, in order, without one, so an admin may add or reorder the steps of a running mystery.
Everything that changes a player's game happens under the lock on the player (as missions do), then
the mystery's row: two phones of one player cannot both solve the same step.
"""

import hmac
import math
import unicodedata
from dataclasses import dataclass
from datetime import timedelta

from django.db import transaction
from django.db.models import Avg, Count, Max, Min, Q, Sum
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
    "audience": "این بازی برای گروه سنی یا مخاطب دیگری ساخته شده است.",
    "inactive": "این معما فعلاً غیرفعال است.",
    "upcoming": "این معما هنوز شروع نشده است.",
    "expired": "زمان این معما تمام شده است.",
    "full": "ظرفیت این معما تکمیل شده است.",
    "empty": "این معما هنوز آماده نیست.",
}


# Told of every payout of a creator's game inside the payout's transaction (Game Master's budget
# ledger registers here): listener(run, step, points, bonus).
payout_listeners: list = []


def not_found():
    return NotFound("این معما پیدا نشد.")


def max_run_points(mystery: Mystery) -> int:
    """The most one player can win in the mystery: every step's points and the finish bonus."""
    return (mystery.steps.aggregate(n=Sum("points"))["n"] or 0) + mystery.finish_points


def funded_runs(mystery: Mystery, max_run: int | None = None) -> int | None:
    """How many players the creator's budget pays in full (None: not a budgeted game)."""
    if mystery.budget_points is None:
        return None
    max_run = max_run_points(mystery) if max_run is None else max_run
    return mystery.budget_points // max_run if max_run > 0 else None


def age_of(customer: Customer, today=None) -> int | None:
    born = customer.birthdate
    if not born:
        return None
    today = today or timezone.localdate()
    return today.year - born.year - ((today.month, today.day) < (born.month, born.day))


def outside_audience(customer: Customer, mystery: Mystery) -> bool:
    """A creator's audience rule this player does not meet (unknown age or gender does not meet a rule)."""
    if mystery.gender and customer.gender != mystery.gender:
        return True
    if mystery.age_min is not None or mystery.age_max is not None:
        age = age_of(customer)
        if age is None:
            return True
        if mystery.age_min is not None and age < mystery.age_min:
            return True
        if mystery.age_max is not None and age > mystery.age_max:
            return True
    return False


def unavailable(
    mystery: Mystery, now=None, started: int | None = None, steps: int | None = None, max_run: int | None = None
) -> str | None:
    """Why a new player cannot start the mystery now, or None. (`full` does not stop those already
    playing; the rest do.) A creator's game is also full once its budget pays no further player."""
    now = now or timezone.now()
    if not mystery.is_active:
        return "inactive"
    if mystery.starts_at and now < mystery.starts_at:
        return "upcoming"
    if mystery.ends_at and now >= mystery.ends_at:
        return "expired"
    if (steps if steps is not None else mystery.steps.count()) == 0:
        return "empty"
    limits = [n for n in (mystery.capacity, funded_runs(mystery, max_run)) if n is not None]
    if limits:
        if started is None:
            started = mystery.runs.count()
        if started >= min(limits):
            return "full"
    return None


def in_grace(mystery: Mystery, now=None) -> bool:
    """Ended for newcomers, but those already playing may still finish."""
    now = now or timezone.now()
    return bool(mystery.ends_at and now >= mystery.ends_at and mystery.grace_ends_at and now < mystery.grace_ends_at)


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
    # A creator game's older version the player is still in (hidden since a new version replaced
    # it) stays in their list; the newer one of the same edition does not (one game per edition).
    mine = MysteryRun.objects.filter(customer=customer, mystery__series__isnull=False).values_list("mystery_id", flat=True)
    mysteries = list(
        Mystery.objects.filter(Q(is_visible=True) | Q(pk__in=mine))
        .exclude(access=Mystery.Access.PRIVATE)
        .filter(Q(ends_at__isnull=True) | Q(ends_at__gt=now - SHOW_ENDED_FOR))
    )
    if not mysteries:
        return []
    ids = [m.pk for m in mysteries]
    playing = {(s, e) for s, e in Mystery.objects.filter(pk__in=list(mine)).values_list("series", "edition")}

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
        # A creator's game is listed only to its audience, and not while paused or once ended (its
        # players still see theirs); nor a version of an edition the player is already in.
        if run is None and m.is_creator_game and (
            not m.is_active or outside_audience(customer, m) or (m.ends_at and now >= m.ends_at) or (m.series, m.edition) in playing
        ):
            continue
        max_run = (step_points.get(m.pk) or 0) + m.finish_points
        reason = unavailable(m, now, n_runs.get(m.pk, 0), n_steps.get(m.pk, 0), max_run)
        if run and reason == "expired" and in_grace(m, now):
            reason = None  # ended for newcomers; its players may still finish
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
    if run is None and mystery is not None and mystery.series:
        # Another version of the same edition is the one this player plays.
        run = edition_run(customer, mystery)
        if run is not None:
            mystery = Mystery.objects.filter(pk=run.mystery_id).annotate(n_steps=Count("steps", distinct=True)).first()
    if run is None:
        raise not_found()
    reason = unavailable(mystery, steps=mystery.n_steps, started=0)
    if reason == "expired" and in_grace(mystery):
        reason = None
    state = "done" if run.status == RunStatus.COMPLETED else (reason or "in_progress")
    total = sum(s.points for s in mystery.steps.all()) + mystery.finish_points
    return View(mystery, state, mystery.n_steps, run.checkins.count(), total, run)


# ── playing ──


def edition_run(customer: Customer, mystery: Mystery) -> MysteryRun | None:
    """The player's game in this creator game's edition (whichever version they started), if any."""
    if not mystery.series:
        return None
    return (
        MysteryRun.objects.filter(customer=customer, mystery__series=mystery.series, mystery__edition=mystery.edition)
        .order_by("create_time")
        .first()
    )


def _new_run(customer: Customer, mystery: Mystery) -> MysteryRun:
    """A new game, checked: open, not full (nor past its budget), for this audience, and not an
    edition this player already plays (a new version of a game is not a second chance at its points)."""
    if edition_run(customer, mystery) is not None:
        raise MissionError("این بازی را قبلاً شروع کرده‌ای؛ از «دریافت امتیاز» همان را ادامه بده.", "played")
    reason = unavailable(mystery)
    if reason:
        raise MissionError(UNAVAILABLE[reason], reason)
    if outside_audience(customer, mystery):
        raise MissionError(UNAVAILABLE["audience"], "audience")
    return MysteryRun.objects.create(customer=customer, mystery=mystery, step_started_at=timezone.now())


def start(customer: Customer, mystery_id, invite: str | None = None) -> MysteryRun:
    """Starts the player's game (or returns the one they have). A private game starts only with
    its invite."""
    with transaction.atomic():
        _lock(customer)
        # Locked: the last free place goes to one player only.
        mystery = Mystery.objects.select_for_update().filter(pk=mystery_id).first()
        if mystery is None:
            raise not_found()
        run = MysteryRun.objects.filter(customer=customer, mystery=mystery).first() or edition_run(customer, mystery)
        if run:
            return run
        if mystery.access == Mystery.Access.PRIVATE:
            given = (invite or "").encode()
            if not given or not hmac.compare_digest(given, (mystery.invite_token or "").encode()):
                raise not_found()
        elif not mystery.is_visible:
            raise not_found()
        return _new_run(customer, mystery)


def start_by_invite(customer: Customer, token: str) -> MysteryRun:
    """A private game's invite link (/pwa/play/<token>): joins (or reopens) the game."""
    mystery = Mystery.objects.filter(invite_token=token, access=Mystery.Access.PRIVATE).first() if token else None
    if mystery is None:
        raise NotFound("این لینک دعوت معتبر نیست.")
    return start(customer, mystery.pk, invite=token)


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
    """A running game can go on unless the mystery was switched off or has ended (and the time its
    players were given to finish, if any, is over too). Checked on every move: no timer needed."""
    now = timezone.now()
    if not mystery.is_active:
        raise MissionError(UNAVAILABLE["inactive"], "inactive")
    if mystery.ends_at and now >= mystery.ends_at and not (mystery.grace_ends_at and now < mystery.grace_ends_at):
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


# ── help, a level at a time ──
# A step's help goes from a nudge to the result: the admin's hint lines (least to most), then the
# place itself (name, address, map), and for an answer step at last the answer. Each level opened
# takes the mystery's hint_penalty percent of the step's points; the answer leaves none.


def hint_levels(step: MysteryStep) -> list[str]:
    """The kinds of the step's help levels, in order: "text" (one per hint line), "place" (a step at
    a real place), "answer" (an answer or choice step). A read-only step has none."""
    if step.proof == Proof.INFO:
        return []
    levels = ["text"] * len(step.hint_lines())
    if step.is_place:
        levels.append("place")
    if step.proof in (Proof.ANSWER, Proof.CHOICE):
        levels.append("answer")
    return levels


def step_points(step: MysteryStep, mystery: Mystery, used: int) -> int:
    """What the step pays after `used` help levels."""
    levels = hint_levels(step)
    if used and levels[min(used, len(levels)) - 1] == "answer":
        return 0
    return max(0, step.points * (100 - mystery.hint_penalty * used) // 100)


def hint_view(step: MysteryStep, mystery: Mystery, used: int) -> dict:
    """The opened help levels (their content), and what the next one is and costs."""
    levels, lines = hint_levels(step), step.hint_lines()
    used = min(used, len(levels))
    shown = []
    for i, kind in enumerate(levels[:used]):
        if kind == "text":
            shown.append({"kind": "text", "text": lines[i]})
        elif kind == "place":
            shown.append({"kind": "place", "name": step.place_name, "address": step.place_address, "map": step.map_link()})
        else:
            shown.append({"kind": "answer", "answer": (step.answer_list() or [""])[0]})
    now = step_points(step, mystery, used)
    following = levels[used] if used < len(levels) else None
    return {
        "hints": shown,
        "hints_total": len(levels),
        "next_hint": following,
        "next_hint_cost": now - step_points(step, mystery, used + 1) if following else 0,
        "points_now": now,
    }


def reveal_hint(customer: Customer, mystery_id, step_id) -> MysteryRun:
    """Opens the current step's next help level (its points go down)."""
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
        if _step_for(run, step, steps):
            raise MissionError("این مرحله را حل کرده‌ای.", "done")
        _check_open(mystery)
        if run.hints_used >= len(hint_levels(step)):
            raise MissionError("راهنمایی دیگری برای این مرحله نیست.", "no_more_hints")
        run.hints_used += 1
        run.save(update_fields=["hints_used", "update_time"])
        return run


def _pay(run: MysteryRun, step: MysteryStep, method: str, distance=None, accuracy=None) -> Result:
    """Records the visit, pays the step (less its help) and the finish bonus after the last step."""
    mystery = run.mystery
    now = timezone.now()
    points = step_points(step, mystery, run.hints_used)
    if step.time_limit_s and run.step_started_at and (now - run.step_started_at).total_seconds() > step.time_limit_s:
        points = 0  # solved, but after its time: no points
    if step.proof == Proof.CHOICE and (run.wrong_tries or run.locked_until):
        points = 0  # a choice is one guess: trying every option must not pay (the stage still opens the next)
    checkin = MysteryCheckin.objects.create(
        run=run, step=step, customer=run.customer, method=method, points=points, hints_used=run.hints_used,
        distance_m=distance, accuracy_m=accuracy,
    )
    if points:
        # The points reach the points wallet through the ActivityTransaction post_save signal.
        checkin.activity_transaction = ActivityTransaction.objects.create(
            customer=run.customer,
            section=SECTION,
            action_type=f"mystery-step:{checkin.pk}",
            score_value=points,
            reward_data={"score": points},
            metadata={"mystery": str(mystery.pk), "step": str(step.pk), "title": f"معمای «{mystery.title}» — {step.place_name}"},
            status=ActivityTransaction.Status.COMPLETED,
            description=f"Mystery: {mystery.title} / {step.place_name}"[:255],
        )
        checkin.save(update_fields=["activity_transaction", "update_time"])
    run.points_earned += points
    run.wrong_tries = 0
    run.locked_until = None
    run.hints_used = 0
    run.step_started_at = now
    result = Result(run, step, already=False, points=points)
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
    if mystery.is_creator_game:
        for listener in payout_listeners:
            listener(run, step, result.points, result.bonus)
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
        if step.proof in (Proof.GPS, Proof.INFO):
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
            if step.proof == Proof.CHOICE:
                refusal = MissionError("این گزینه درست نیست؛ امتیاز این مرحله از دست رفت، ولی می‌توانی ادامه بدهی.", "wrong")
            else:
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
            # (A mystery hidden from the list starts this way too: a poster-only hunt; a private
            # game's first QR is as good as its invite.)
            run = _new_run(customer, mystery)
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
            hints=Avg("hints_used"),
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
                "hints": round(rows.get(s.pk, {}).get("hints") or 0, 1),
                "daily": [daily.get((s.pk, d), 0) for d in days],
            }
            for s in steps
        ],
        "days": days,
        "started": runs["started"],
        "completed": runs["completed"],
    }
