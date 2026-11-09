"""Game Master: a creator game's life — draft, submitted version, review, publication, pause, archive.

Rules kept here (the API and the admin only call these):
- Only the owner edits a game, and only its draft; a submitted version never changes (models.py).
- Only a reviewer (permission gamemaster.review_game, never the game's own creator) approves.
- Nothing reaches players without an approved version; publication compiles that version into a
  Mystery (the shared runtime), after its fee is paid and its points budget reserved.
"""

from dataclasses import dataclass
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from apps.configuration.models.system_configuration import SystemConfiguration
from apps.gamemaster import budget, schema, starters, zibal
from apps.gamemaster.models import CreatorProfile, Game, GameAuditLog, GamePayment, GameReview, GameVersion
from apps.missions import leaderboard as boards
from apps.missions import mystery as engine
from apps.missions.models import Mystery, MysteryRun, MysteryStep

Status = Game.Status
VStatus = GameVersion.Status
TERMS_VERSION = "1"

# Settings (admin → System configurations; env vars of the same name; else these). No price here is
# a real price: each is set by Bordino in the admin.
DEFAULTS = {
    # Who can use Game Master: "off" (nobody), "staff" (Bordino's staff only, for trying it), "all".
    "GM_ACCESS": "off",
    # The publication fee per category, in toman (0 = free). Charged after approval, before publication.
    "GM_FEE_BUSINESS_TOMAN": 0,
    "GM_FEE_PERSONAL_TOMAN": 0,
    "GM_FEE_PRO_TOMAN": 0,
    # Packages: a fee covers this many stages; each stage beyond them adds this much (toman).
    "GM_INCLUDED_STAGES": 5,
    "GM_EXTRA_STAGE_TOMAN": 0,
    # Zibal: "sandbox" (the first step: no money moves), "test" (Zibal's test merchant), "live".
    "GM_ZIBAL_MODE": "sandbox",
    "GM_ZIBAL_MERCHANT": "",
    # SMS (Kavenegar templates, approved in Kavenegar's panel; %token10% = the game's title).
    "GM_SMS_TEMPLATE_APPROVED": "gmApproved",
    "GM_SMS_TEMPLATE_CHANGES": "gmChanges",
    "GM_SMS_TEMPLATE_PUBLISHED": "gmPublished",
    # How many games a creator may have open (not archived) at once.
    "GM_MAX_OPEN_GAMES": 10,
    # Image uploads per creator: per day and in all (each ≤5 MB).
    "GM_MAX_UPLOADS_PER_DAY": 60,
    "GM_MAX_UPLOADS_TOTAL": 500,
    # Future phases, off until approved.
    # How long a new game runs by default (days; 0 = no automatic end), by kind; a competitive
    # template (the quiz) has its own. The creator may change it within the maximum.
    "GM_EXPIRY_DAYS_PERSONAL": 30,
    "GM_EXPIRY_DAYS_BUSINESS": 30,
    "GM_EXPIRY_DAYS_PRO": 0,
    "GM_EXPIRY_DAYS_COMPETITIVE": 7,
    # The longest a game of each kind may run (days; 0 = no limit, and then «no end» is allowed).
    "GM_MAX_DAYS_PERSONAL": 0,
    "GM_MAX_DAYS_BUSINESS": 0,
    "GM_MAX_DAYS_PRO": 0,
    # The longest time players may be given to finish after a game ends (hours).
    "GM_MAX_GRACE_HOURS": 168,
    # The kinds of game that may have a leaderboard (comma-separated), and team competition (off:
    # the game runtime has no team sessions yet).
    "GM_LEADERBOARD_CATEGORIES": "business,personal,pro",
    "GM_TEAMS_ENABLED": False,
    "GM_MARKETPLACE_ENABLED": False,
    "GM_USAGE_BILLING_ENABLED": False,
    "GM_SMS_ENABLED": False,
}

EDITABLE = (Status.DRAFT, Status.CHANGES_REQUESTED, Status.REJECTED)
# A live game can be edited too: the next version is reviewed while the live one keeps running.
LIVE = (Status.PUBLISHED, Status.SCHEDULED, Status.PAUSED)
# Games players have had: a new version of them keeps the game's status until it is published.
PLAYED = LIVE + (Status.EXPIRED,)
COMPETITIVE_TEMPLATES = ("quiz",)


def setting(key: str):
    return SystemConfiguration.objects.get(key, DEFAULTS[key])


class GameMasterError(Exception):
    def __init__(self, message: str, code: str = "invalid", errors: dict | None = None):
        super().__init__(message)
        self.message = message
        self.code = code
        self.errors = errors or {}


def _not_found():
    return GameMasterError("این بازی پیدا نشد.", "not_found")


def can_use(user) -> bool:
    access = str(setting("GM_ACCESS") or "off").lower()
    if access == "all":
        return True
    if access == "staff":
        return bool(user.is_staff or user.is_superuser)
    return False


def is_reviewer(user) -> bool:
    return bool(user and user.is_active and (user.is_superuser or user.has_perm("gamemaster.review_game")))


def audit(game, actor, action: str, **data):
    GameAuditLog.objects.create(game=game, actor=actor, action=action, data=data)


def _notify(game: Game, title: str, body: str, sms: str | None = None):
    """The creator's in-app/push notice; and an SMS (a Kavenegar template) when SMS is switched on."""
    from apps.notifications import services as notifications  # pylint: disable=import-outside-toplevel

    try:
        notifications.queue(game.owner.user.customer, "account", title, body, url=f"/pwa/gm/games/{game.pk}")
    except Exception:  # pylint: disable=broad-except
        pass  # a notice is a courtesy, never the reason an action fails
    if sms and setting("GM_SMS_ENABLED"):
        send_sms(game.owner.user.phone_number, str(setting(sms) or ""), game.title)


def send_sms(phone: str, template: str, title: str) -> bool:
    """One Game Master SMS through Bordino's Kavenegar account (verify lookup, like the login code)."""
    if not template or not phone:
        return False
    try:
        from kavenegar import KavenegarAPI  # pylint: disable=import-outside-toplevel

        from apps.user_management.services.utils import normalize_phone_number  # pylint: disable=import-outside-toplevel

        words = " ".join(str(title).split()[:5])[:60] or "بردینو"
        KavenegarAPI(settings.KAVENEGAR_API_KEY).verify_lookup(
            {"receptor": normalize_phone_number(phone), "template": template, "token": "بردینو", "token10": words, "type": "sms"}
        )
        return True
    except Exception:  # pylint: disable=broad-except
        return False  # never the reason a review or a publication fails


# ── the creator ──


def profile(user, create: bool = False) -> CreatorProfile | None:
    found = CreatorProfile.objects.filter(user=user).first()
    if found is None and create:
        found = CreatorProfile.objects.create(user=user)
    return found


def update_profile(user, data: dict) -> CreatorProfile:
    """Mode, onboarding (intent, terms) and business details. Switching to Game Master needs access."""
    p = profile(user, create=True)
    mode = data.get("preferred_mode")
    if mode in (CreatorProfile.Mode.PLAYER, CreatorProfile.Mode.CREATOR):
        if mode == CreatorProfile.Mode.CREATOR and not can_use(user):
            raise GameMasterError("گیم مستر هنوز برای همه باز نشده است.", "closed")
        p.preferred_mode = mode
    if data.get("intent") in CreatorProfile.Intent.values:
        p.intent = data["intent"]
    if data.get("accept_terms") is True and not p.terms_accepted_at:
        p.terms_accepted_at = timezone.now()
        p.terms_version = TERMS_VERSION
    for field, limit in (("business_name", 120), ("business_phone", 20)):
        if field in data:
            setattr(p, field, str(data.get(field) or "").strip()[:limit])
    p.save()
    return p


def creator(user) -> CreatorProfile:
    """The user's creator profile, ready to create (access open, onboarded, not blocked)."""
    if not can_use(user):
        raise GameMasterError("گیم مستر هنوز برای همه باز نشده است.", "closed")
    p = profile(user)
    if p is None or not p.onboarded:
        raise GameMasterError("اول معرفی گیم مستر را کامل کن.", "onboarding")
    if p.is_blocked:
        raise GameMasterError("حساب سازندهٔ تو مسدود شده است؛ با پشتیبانی تماس بگیر.", "blocked")
    return p


def owned(user, game_id, lock: bool = False) -> Game:
    """One of this creator's games (another creator's is «not found», never «forbidden»)."""
    p = creator(user)
    games = Game.objects.select_for_update() if lock else Game.objects
    game = games.filter(pk=game_id, owner=p).first()
    if game is None:
        raise _not_found()
    return game


# ── drafts ──


def create_game(user, category: str, template: str | None = None, title: str = "") -> Game:
    p = creator(user)
    if category not in Game.Category.values:
        raise GameMasterError("نوع بازی را انتخاب کن.")
    open_games = Game.objects.filter(owner=p).exclude(status=Status.ARCHIVED).count()
    if open_games >= int(setting("GM_MAX_OPEN_GAMES") or 10):
        raise GameMasterError("تعداد بازی‌های باز تو به سقف رسیده؛ یکی را بایگانی کن.", "limit")
    definition = starters.definition(template) if template else None
    if template and definition is None:
        raise GameMasterError("این قالب پیدا نشد.")
    definition = schema.clean(definition or schema.empty())
    if title:
        definition["title"] = title[:120]
    if category == Game.Category.PERSONAL:
        definition["access"] = "private"
    if p.business_name and not definition.get("presenter"):
        definition["presenter"] = p.business_name
    definition["availability"] = default_availability(category, template)
    if template in COMPETITIVE_TEMPLATES and leaderboard_allowed(category):
        # A competition: its board is suggested (one click turns it off).
        definition["leaderboard"] = boards.preset_config("score")
    definition = schema.clean(definition)
    game = Game.objects.create(
        owner=p, category=category, template=template or "", title=definition["title"], draft=definition, draft_saved_at=timezone.now()
    )
    audit(game, user, "create", template=template or "")
    return game


def default_availability(category: str, template: str | None) -> dict:
    """A new game's end, from Bordino's settings: so many days, or none."""
    key = "COMPETITIVE" if template in COMPETITIVE_TEMPLATES else category.upper()
    days = int(setting(f"GM_EXPIRY_DAYS_{key}") or 0)
    if days <= 0:
        return {"expiry": "none", "duration_value": None, "duration_unit": "days", "after": "strict", "grace_hours": 0}
    return {"expiry": "duration", "duration_value": days, "duration_unit": "days", "after": "strict", "grace_hours": 0}


def leaderboard_allowed(category: str) -> bool:
    allowed = {c.strip() for c in str(setting("GM_LEADERBOARD_CATEGORIES") or "").split(",")}
    return category in allowed


def problems(game: Game, definition: dict, now=None) -> dict:
    """What stops this definition from being submitted (or published): the schema's checks and
    Bordino's limits for this kind of game (how long it may run, its leaderboard)."""
    d = schema.clean(definition)
    errors = schema.check(d)
    now = now or timezone.now()
    most = int(setting(f"GM_MAX_DAYS_{game.category.upper()}") or 0)
    if most > 0:
        days = schema.length_days(d, now)
        if days is None:
            errors["availability.expiry"] = f"بازی‌های این نوع حداکثر {schema.fa(most)} روز باز می‌مانند؛ زمان پایان را مشخص کن."
        elif days > most + 1e-6:
            errors["availability.expiry"] = f"بازی‌های این نوع حداکثر {schema.fa(most)} روز باز می‌مانند."
    grace = d["availability"]["grace_hours"]
    if grace > int(setting("GM_MAX_GRACE_HOURS") or 0):
        errors["availability.grace_hours"] = f"مهلت تمام کردن حداکثر {schema.fa(int(setting('GM_MAX_GRACE_HOURS') or 0))} ساعت است."
    if boards.enabled(d["leaderboard"]) and not leaderboard_allowed(game.category):
        errors["leaderboard.preset"] = "جدول رده‌بندی برای این نوع بازی فعال نیست."
    return errors


def save_draft(user, game_id, definition: dict) -> Game:
    """Autosave: the working copy (it may be incomplete); never a submitted version."""
    with transaction.atomic():
        game = owned(user, game_id, lock=True)
        if game.status not in EDITABLE + PLAYED + (Status.APPROVED,):
            raise GameMasterError("این بازی الان در بررسی است و ویرایش نمی‌شود.", "locked")
        try:
            game.draft = schema.clean(definition)
        except schema.DefinitionError as exc:
            raise GameMasterError(exc.args[0], "invalid", exc.errors) from exc
        if game.category == Game.Category.PERSONAL:
            game.draft["access"] = "private"
        game.title = game.draft["title"]
        game.draft_saved_at = timezone.now()
        if game.status == Status.APPROVED:
            # Changing an approved, unpublished game sends it back to the creator's hands: the
            # approval was for the version as it was.
            game.status = Status.DRAFT
            audit(game, user, "edit_after_approval")
        game.save(update_fields=["draft", "title", "draft_saved_at", "status", "update_time"])
        return game


def duplicate(user, game_id) -> Game:
    source = owned(user, game_id)
    copy = create_game(user, source.category, None, f"{source.title} (کپی)"[:120])
    copy.draft = {**schema.clean(source.draft), "title": copy.title}
    copy.save(update_fields=["draft", "update_time"])
    audit(copy, user, "duplicate", source=str(source.pk))
    return copy


def pending_version(game: Game) -> GameVersion | None:
    """The newest version not yet published or superseded (in review, or approved)."""
    return (
        game.versions.filter(status__in=(VStatus.SUBMITTED, VStatus.APPROVED, VStatus.CHANGES_REQUESTED, VStatus.REJECTED))
        .order_by("-number")
        .first()
    )


def submit(user, game_id) -> GameVersion:
    """Freezes the draft as a new version for review."""
    with transaction.atomic():
        game = owned(user, game_id, lock=True)
        if game.status not in EDITABLE + PLAYED:
            raise GameMasterError("این بازی همین حالا در بررسی است.", "locked")
        waiting = game.versions.filter(status=VStatus.SUBMITTED).exists()
        if waiting:
            raise GameMasterError("یک نسخه از این بازی همین حالا در بررسی است.", "locked")
        definition = schema.clean(game.draft)
        errors = problems(game, definition)
        used = schema.images(definition)
        if used:
            from apps.gamemaster.models import GameAsset  # pylint: disable=import-outside-toplevel

            mine = set(GameAsset.objects.filter(owner=game.owner, image__in=used).values_list("image", flat=True))
            if used - mine:
                errors["images"] = "یکی از تصویرها مال این حساب نیست؛ دوباره بارگذاری‌اش کن."
        if errors:
            raise GameMasterError("چند چیز هنوز کامل نیست.", "incomplete", errors)
        number = (game.versions.order_by("-number").values_list("number", flat=True).first() or 0) + 1
        version = GameVersion.objects.create(game=game, number=number, definition=definition, schema_version=schema.SCHEMA)
        if game.status not in PLAYED:
            game.status = Status.SUBMITTED
        game.title = definition["title"]
        game.save(update_fields=["status", "title", "update_time"])
        audit(game, user, "submit", version=number)
    return version


# ── review (Bordino) ──


def review(reviewer, version_id, decision: str, note: str = "") -> GameVersion:
    """approve / reject / changes — by a reviewer who is not the game's creator."""
    if not is_reviewer(reviewer):
        raise GameMasterError("فقط بررسی‌کنندهٔ بردینو این کار را می‌کند.", "forbidden")
    note = (note or "").strip()
    if decision not in GameReview.Decision.values:
        raise GameMasterError("تصمیم نامعتبر است.")
    if decision != GameReview.Decision.APPROVE and not note:
        raise GameMasterError("دلیل رد یا اصلاح را بنویسید (سازنده می‌بیند).")
    with transaction.atomic():
        game_id = GameVersion.objects.filter(pk=version_id).values_list("game_id", flat=True).first()
        if game_id is None:
            raise _not_found()
        # The game first, then the version: the same order as publish() (no deadlock).
        game = Game.objects.select_for_update().select_related("owner").get(pk=game_id)
        version = GameVersion.objects.select_for_update().get(pk=version_id)
        if game.owner.user_id == reviewer.pk:
            raise GameMasterError("سازندهٔ یک بازی نمی‌تواند بازی خودش را بررسی کند.", "forbidden")
        if version.status != VStatus.SUBMITTED:
            raise GameMasterError("این نسخه در انتظار بررسی نیست.", "conflict")
        live = game.status in PLAYED
        if decision == GameReview.Decision.APPROVE:
            version.status = VStatus.APPROVED
            version.fee_toman = fee_for(game.category, version.definition)
            if not live:
                game.status = Status.APPROVED
        elif decision == GameReview.Decision.REJECT:
            version.status = VStatus.REJECTED
            if not live:
                game.status = Status.REJECTED
        else:
            version.status = VStatus.CHANGES_REQUESTED
            if not live:
                game.status = Status.CHANGES_REQUESTED
        version.reviewer = reviewer
        version.reviewed_at = timezone.now()
        version.review_note = note[:2000]
        version.save(update_fields=["status", "reviewer", "reviewed_at", "review_note", "fee_toman", "update_time"])
        game.save(update_fields=["status", "update_time"])
        GameReview.objects.create(version=version, reviewer=reviewer, decision=decision, note=note[:2000])
        audit(game, reviewer, f"review_{decision}", version=version.number, note=note[:300])
    texts = {
        "approve": ("بازی تو تأیید شد", f"«{game.title}» تأیید شد؛ حالا می‌توانی منتشرش کنی.", "GM_SMS_TEMPLATE_APPROVED"),
        "reject": ("بازی تو رد شد", f"«{game.title}»: {note}", "GM_SMS_TEMPLATE_CHANGES"),
        "changes": ("بازی تو اصلاح لازم دارد", f"«{game.title}»: {note}", "GM_SMS_TEMPLATE_CHANGES"),
    }
    _notify(game, *texts[decision])
    return version


# ── fees (Zibal) ──


def fee_for(category: str, definition: dict) -> int:
    """The publication fee (toman) from today's prices: the category's base, plus each stage beyond
    the ones it includes (a bigger personal game is a bigger package)."""
    base = int(setting(f"GM_FEE_{category.upper()}_TOMAN") or 0)
    if not base:
        return 0
    extra = max(0, len(definition.get("stages") or []) - int(setting("GM_INCLUDED_STAGES") or 0))
    return base + extra * int(setting("GM_EXTRA_STAGE_TOMAN") or 0)


def start_payment(user, game_id) -> tuple[GamePayment, str]:
    """The approved version's fee: a Zibal transaction (an open one is reused) and where to pay it."""
    with transaction.atomic():
        game = owned(user, game_id, lock=True)
        version = game.versions.select_for_update().filter(status=VStatus.APPROVED).order_by("-number").first()
        if version is None:
            raise GameMasterError("نسخهٔ تأییدشده‌ای برای پرداخت نیست.", "not_approved")
        if not version.fee_toman or version.fee_paid:
            raise GameMasterError("این نسخه پرداختی لازم ندارد.", "nothing_to_pay")
        mode = zibal.mode()
        open_one = version.payments.filter(status=GamePayment.Status.PENDING, mode=mode, create_time__gte=timezone.now() - timedelta(minutes=20)).first()
        base = public_base()
        callback = f"{base}/pwa/gm/pay/callback"
        if open_one is None:
            try:
                track = zibal.request(version.fee_toman, f"انتشار بازی «{game.title}» در بردینو", callback, str(version.pk), user.phone_number or "")
            except zibal.ZibalError as exc:
                raise GameMasterError(str(exc), "gateway") from exc
            open_one = GamePayment.objects.create(
                creator=game.owner, game=game, version=version, amount_toman=version.fee_toman, track_id=track, mode=mode
            )
            audit(game, user, "payment_start", track=track, amount=version.fee_toman, mode=mode)
    sandbox = f"{base}/pwa/gm/pay/sandbox?trackId={open_one.track_id}&amount={open_one.amount_toman}"
    return open_one, zibal.pay_url(open_one.track_id, sandbox)


def confirm_payment(user, track_id: str, success: bool) -> GamePayment:
    """The payer is back from Zibal (or the sandbox page): asks Zibal, marks it paid once."""
    with transaction.atomic():
        payment = GamePayment.objects.select_for_update().select_related("version", "game", "creator").filter(track_id=str(track_id or "")).first()
        if payment is None or payment.creator.user_id != user.pk:
            raise _not_found()
        if payment.status == GamePayment.Status.PAID:
            return payment  # again (a reload): already done
        if payment.mode != zibal.mode():
            raise GameMasterError("حالت درگاه عوض شده؛ دوباره پرداخت کن.", "gateway")
        if not success and payment.mode == "sandbox":
            payment.status = GamePayment.Status.FAILED
            payment.save(update_fields=["status", "update_time"])
            return payment
        try:
            result = zibal.verify(payment.track_id, sandbox_success=success)
        except zibal.ZibalError as exc:
            raise GameMasterError(str(exc), "gateway") from exc
        if result.ok and result.amount_rial is not None and result.amount_rial != payment.amount_toman * 10:
            result.ok = False  # paid a different amount: not this fee
        payment.status = GamePayment.Status.PAID if result.ok else GamePayment.Status.FAILED
        payment.ref_number, payment.card = result.ref_number[:64], result.card[:32]
        payment.verified_at = timezone.now()
        payment.save(update_fields=["status", "ref_number", "card", "verified_at", "update_time"])
        if result.ok:
            GameVersion.objects.filter(pk=payment.version_id).update(fee_paid=True)
        audit(payment.game, user, "payment_" + payment.status, track=payment.track_id, ref=payment.ref_number, mode=payment.mode)
    return payment


# ── publication ──


def invite_token(game: Game) -> str:
    """The game's invite (made the first time it is asked for)."""
    if not game.invite_token:
        from apps.missions.models import new_callback_secret  # pylint: disable=import-outside-toplevel

        Game.objects.filter(pk=game.pk, invite_token__isnull=True).update(invite_token=new_callback_secret())
        game.invite_token = Game.objects.values_list("invite_token", flat=True).get(pk=game.pk)
    return game.invite_token


def share(game: Game) -> dict:
    """What the creator shares: a private game's invite link (from the first draft; it works once
    published), or a public game's page once it is published."""
    base = public_base()
    live = game.live_version
    mystery = getattr(live, "mystery", None) if live else None
    open_now = mystery is not None and game.status in (Status.PUBLISHED, Status.SCHEDULED)
    if (game.draft or {}).get("access") == "private" or (mystery is not None and mystery.access == Mystery.Access.PRIVATE):
        working = open_now and mystery.access == Mystery.Access.PRIVATE and mystery.invite_token == invite_token(game)
        return {"kind": "invite", "url": f"{base}/pwa/play/{invite_token(game)}", "active": working}
    if mystery is not None:
        return {"kind": "public", "url": f"{base}/pwa/earn/mystery/{mystery.pk}", "active": open_now}
    return {"kind": "public", "url": "", "active": False}


def _compile(game: Game, version: GameVersion, now=None) -> Mystery:
    """The approved version as a Mystery and its steps (what players play). Its end is fixed now: a
    duration counts from this publication."""
    d = version.definition
    audience = d.get("audience") or {}
    ends_at, grace_ends_at = schema.end_times(schema.clean(d), now or timezone.now())
    mystery = Mystery(
        title=d["title"],
        summary=d.get("summary", ""),
        story=d.get("story", ""),
        area=d.get("area", ""),
        duration_minutes=d.get("duration_minutes"),
        finish_points=d.get("finish_points") or 0,
        hint_penalty=d.get("hint_penalty") if d.get("hint_penalty") is not None else 25,
        starts_at=parse_datetime(d["starts_at"]) if d.get("starts_at") else None,
        ends_at=ends_at,
        grace_ends_at=grace_ends_at,
        series=game.pk,
        edition=game.edition,
        leaderboard=boards.clean(d.get("leaderboard")),
        capacity=d.get("capacity"),
        is_active=True,
        is_visible=d.get("access") != "private",
        owner=game.owner.user.customer,
        source_version=version,
        presenter=d.get("presenter") or game.owner.business_name,
        access=Mystery.Access.PRIVATE if d.get("access") == "private" else Mystery.Access.PUBLIC,
        invite_token=invite_token(game) if d.get("access") == "private" else None,
        completion_message=d.get("completion_message", ""),
        age_min=audience.get("age_min"),
        age_max=audience.get("age_max"),
        gender=audience.get("gender") or "",
        budget_points=d.get("budget_points") or 0,
    )
    if d.get("cover"):
        mystery.cover.name = d["cover"]
    mystery.save()
    for fields in schema.compile_steps(d):
        image = fields.pop("clue_image")
        step = MysteryStep(mystery=mystery, **fields)
        if image:
            step.clue_image.name = image
        step.save()
    return mystery


def _close(mystery: Mystery, keep_players: bool):
    """A replaced or archived game's Mystery: no new players; its current ones may finish (kept).
    Its invite passes to the next version (or, archived, stops working)."""
    started = mystery.runs.count()
    mystery.is_visible = False
    mystery.invite_token = None
    mystery._no_invite = True  # pylint: disable=protected-access
    mystery.capacity = started  # nobody new, not even by its first QR
    if not keep_players:
        mystery.is_active = False
    mystery.save(update_fields=["is_visible", "capacity", "is_active", "invite_token", "update_time"])


def publish(user, game_id, new_edition: bool = False) -> Game:
    """The creator publishes the approved version: fee paid (or none), budget reserved, compiled.
    A game that was played before goes on (the same edition: its players and leaderboard carry on)
    or, with `new_edition`, starts a new edition (new players' games, a new leaderboard)."""
    with transaction.atomic():
        game = owned(user, game_id, lock=True)
        version = game.versions.select_for_update().filter(status=VStatus.APPROVED).order_by("-number").first()
        if version is None:
            raise GameMasterError("نسخهٔ تأییدشده‌ای برای انتشار نیست.", "not_approved")
        if game.paused_by_admin:
            raise GameMasterError("این بازی توسط بردینو متوقف شده است.", "paused")
        if version.fee_toman and not version.fee_paid:
            raise GameMasterError(f"اول هزینهٔ انتشار ({schema.fa(version.fee_toman)} تومان) را پرداخت کن.", "payment_required")
        d = version.definition
        now = timezone.now()
        end, _ = schema.end_times(schema.clean(d), now)
        if end is not None and end <= now:
            raise GameMasterError("زمان پایان این بازی گذشته است؛ تاریخ را عوض کن و دوباره بفرست.", "expired")
        limits = {k: v for k, v in problems(game, d, now).items() if k.startswith("availability.")}
        if limits:
            raise GameMasterError(next(iter(limits.values())), "invalid", limits)
        played_before = game.versions.filter(mystery__isnull=False).exists()
        if new_edition and not played_before:
            new_edition = False  # (the first publication is the first edition)
        previous_m = getattr(game.live_version, "mystery", None) if game.live_version else None
        if played_before and not new_edition and previous_m is not None and game.status == Status.EXPIRED:
            # An edition whose end passed for good (its result frozen) is not reopened: this
            # publication is its next edition, and the final result stays as it was.
            if boards.snapshot_of(previous_m) is not None or (boards.ended_at(previous_m) and boards.ended_at(previous_m) <= now):
                new_edition = True
        try:
            budget.reserve(game, version, int(d.get("budget_points") or 0))
        except budget.BudgetError as exc:
            raise GameMasterError(exc.message, exc.code) from exc
        previous = game.live_version
        if previous is not None and getattr(previous, "mystery", None) is not None:
            _close(previous.mystery, keep_players=True)
            GameVersion.objects.filter(pk=previous.pk).update(status=VStatus.SUPERSEDED)
        if new_edition:
            game.edition += 1
        mystery = _compile(game, version, now)
        if not new_edition:
            # The same edition goes on (an extension, a correction): those still playing an earlier
            # version play on until this version's end (nobody new joins those).
            Mystery.objects.filter(series=game.pk, edition=game.edition).exclude(pk=mystery.pk).update(
                ends_at=mystery.ends_at, grace_ends_at=mystery.grace_ends_at, update_time=now
            )
        version.status = VStatus.PUBLISHED
        version.published_at = now
        version.save(update_fields=["status", "published_at", "update_time"])
        game.live_version = version
        game.status = Status.SCHEDULED if mystery.starts_at and mystery.starts_at > now else Status.PUBLISHED
        game.save(update_fields=["live_version", "status", "edition", "update_time"])
        audit(game, user, "publish", version=version.number, mystery=str(mystery.pk), edition=game.edition,
              ends_at=mystery.ends_at.isoformat() if mystery.ends_at else None)
    if previous is not None:
        budget.release(previous, "replaced")  # (its own transaction; once per version)
    _notify(game, "بازی تو منتشر شد", f"«{game.title}» حالا برای بازیکنان باز است.", "GM_SMS_TEMPLATE_PUBLISHED")
    return game


def set_paused(actor, game_id, paused: bool, by_admin: bool = False) -> Game:
    """Pause or resume (the creator, or Bordino; only Bordino lifts its own pause)."""
    with transaction.atomic():
        if by_admin:
            if not is_reviewer(actor):
                raise GameMasterError("فقط بردینو این کار را می‌کند.", "forbidden")
            game = Game.objects.select_for_update().filter(pk=game_id).first()
            if game is None:
                raise _not_found()
        else:
            game = owned(actor, game_id, lock=True)
            if game.paused_by_admin:
                raise GameMasterError("این بازی توسط بردینو متوقف شده است.", "paused")
        if game.live_version is None or game.status not in LIVE:
            raise GameMasterError("این بازی منتشر نشده است.", "not_published")
        mystery = game.live_version.mystery
        mystery.is_active = not paused
        mystery.save(update_fields=["is_active", "update_time"])
        game.status = Status.PAUSED if paused else (Status.SCHEDULED if mystery.starts_at and mystery.starts_at > timezone.now() else Status.PUBLISHED)
        if by_admin:
            game.paused_by_admin = paused
        game.save(update_fields=["status", "paused_by_admin", "update_time"])
        audit(game, actor, ("admin_" if by_admin else "") + ("pause" if paused else "resume"))
    if by_admin and paused:
        _notify(game, "بازی تو متوقف شد", f"«{game.title}» توسط بردینو متوقف شد.")
    return game


def archive(actor, game_id, by_admin: bool = False) -> Game:
    """Ends a game for good: closed to everyone, the budget left goes back to the creator."""
    with transaction.atomic():
        if by_admin:
            if not is_reviewer(actor):
                raise GameMasterError("فقط بردینو این کار را می‌کند.", "forbidden")
            game = Game.objects.select_for_update().filter(pk=game_id).first()
            if game is None:
                raise _not_found()
        else:
            game = owned(actor, game_id, lock=True)
        if game.status == Status.ARCHIVED:
            return game
        if game.versions.filter(status=VStatus.SUBMITTED).exists() and not by_admin:
            raise GameMasterError("این بازی در بررسی است؛ بعد از بررسی بایگانی کن.", "locked")
        # Every version players got (the live one and any it replaced): closed to everyone.
        played = list(game.versions.filter(mystery__isnull=False).select_related("mystery"))
        for v in played:
            _close(v.mystery, keep_players=False)
        game.status = Status.ARCHIVED
        game.save(update_fields=["status", "update_time"])
        audit(game, actor, "admin_archive" if by_admin else "archive")
    for v in played:
        budget.release(v, "archived")  # (its own transaction; only what is still left)
    live = game.live_version
    if live is not None and getattr(live, "mystery", None) is not None:
        boards.finalize(live.mystery)  # (once; the history stays)
    return game


def once(game: Game, key: str) -> bool:
    """True the first time `key` is claimed for this game (a notice sent, a result frozen); False
    after, even when two timers race."""
    from django.core.exceptions import ValidationError  # pylint: disable=import-outside-toplevel
    from django.db import IntegrityError  # pylint: disable=import-outside-toplevel

    from apps.gamemaster.models import GameNotice  # pylint: disable=import-outside-toplevel

    key = key[:120]
    if GameNotice.objects.filter(key=key).exists():
        return False
    try:
        with transaction.atomic():
            GameNotice.objects.create(game=game, key=key)
        return True
    except (IntegrityError, ValidationError):  # (claimed meanwhile by another run)
        return False


def _tell_players(mystery: Mystery, title: str, body: str, only_playing: bool = False, limit: int = 5000):
    """A notice to this edition's players (their «بازی‌ها» notices switch decides; no SMS)."""
    from apps.notifications import services as notifications  # pylint: disable=import-outside-toplevel

    runs = MysteryRun.objects.filter(mystery__in=boards.scope_mysteries(mystery))
    if only_playing:
        runs = runs.filter(status=MysteryRun.Status.ACTIVE)
    for run in runs.select_related("customer").order_by("create_time")[:limit]:
        try:
            notifications.queue(run.customer, "games", title, body, url=f"/pwa/earn/mystery/{run.mystery_id}")
        except Exception:  # pylint: disable=broad-except
            pass


def _when_text(when) -> str:
    local = timezone.localtime(when, schema.ZONE)
    return f"{local:%Y/%m/%d %H:%M}".translate(schema.FA_DIGITS)


def settle(game: Game, now=None) -> Game:
    """Keeps a creator's game in step with time (the API and the timer call it; the game runtime
    itself refuses late moves without it):
    - a scheduled game whose start came is published;
    - a live game whose end came is EXPIRED (not archived: its history stays, a new version or a
      new edition may open it again after review);
    - once nobody can make progress any more (its end, or the end of its grace), what is left of
      the budget goes back to the creator and the leaderboard is frozen — once."""
    live = game.live_version
    mystery = getattr(live, "mystery", None) if live else None
    if mystery is None:
        return game
    now = now or timezone.now()
    if game.status in LIVE and mystery.ends_at and mystery.ends_at <= now:
        if Game.objects.filter(pk=game.pk, status__in=LIVE).update(status=Status.EXPIRED, update_time=now):
            audit(game, None, "expired", edition=game.edition, ends_at=mystery.ends_at.isoformat())
            if once(game, f"expired:{mystery.pk}"):
                grace = f" بازیکنانی که شروع کرده‌اند تا {_when_text(mystery.grace_ends_at)} وقت دارند تمامش کنند." if mystery.grace_ends_at else ""
                _notify(game, "زمان بازی تو تمام شد", f"«{game.title}» دیگر بازیکن تازه نمی‌پذیرد.{grace}")
                if mystery.grace_ends_at and mystery.grace_ends_at > now:
                    _tell_players(mystery, "وقت تمام کردن بازی", f"«{game.title}»: تا {_when_text(mystery.grace_ends_at)} وقت داری تمامش کنی.", only_playing=True)
        game.status = Status.EXPIRED
    if game.status == Status.EXPIRED:
        over = boards.ended_at(mystery)
        if over is not None and over <= now and once(game, f"wrapped:{game.pk}:{game.edition}:{mystery.pk}"):
            _wrap_up(game, mystery)
    if game.status == Status.SCHEDULED and (not mystery.starts_at or mystery.starts_at <= now):
        Game.objects.filter(pk=game.pk, status=Status.SCHEDULED).update(status=Status.PUBLISHED)
        game.status = Status.PUBLISHED
    return game


def _wrap_up(game: Game, mystery: Mystery):
    """After the last possible move: the budget left goes back, the leaderboard is frozen, and its
    players (if the board is theirs to see) and the creator are told."""
    for v in game.versions.filter(mystery__isnull=False):
        budget.release(v, "expired")
    snap = boards.finalize(mystery)
    if snap is not None:
        cfg = boards.clean(mystery.leaderboard)
        _notify(game, "نتیجهٔ نهایی جدول", f"جدول رده‌بندی «{game.title}» نهایی شد.")
        if cfg.get("after") not in ("hide", "creator") and cfg.get("visibility") != "creator":
            _tell_players(mystery, "نتیجهٔ نهایی", f"جدول نهایی «{game.title}» آماده است.")


def warn_soon(game: Game, now=None):
    """«Ending soon» to the creator: a week before and a day before (only the nearer one when both
    are already due, never twice)."""
    live = game.live_version
    mystery = getattr(live, "mystery", None) if live else None
    if mystery is None or game.status not in LIVE or not mystery.ends_at:
        return
    now = now or timezone.now()
    left = mystery.ends_at - now
    if left <= timedelta(0):
        return
    published = live.published_at or mystery.create_time
    if left <= timedelta(days=1):
        once(game, f"soon7:{mystery.pk}")  # (past it: no week notice after the day notice)
        if mystery.ends_at - published > timedelta(days=1) and once(game, f"soon1:{mystery.pk}"):
            _notify(game, "بازی تو فردا تمام می‌شود", f"«{game.title}» تا {_when_text(mystery.ends_at)} باز است. برای تمدید، نسخهٔ تازه بفرست.")
    elif left <= timedelta(days=7):
        if mystery.ends_at - published > timedelta(days=7) and once(game, f"soon7:{mystery.pk}"):
            _notify(game, "بازی تو تا یک هفتهٔ دیگر تمام می‌شود", f"«{game.title}» تا {_when_text(mystery.ends_at)} باز است. برای تمدید، نسخهٔ تازه بفرست.")


def tick(now=None) -> int:
    """The timer (every few minutes): every played game settled and warned. Returns how many."""
    now = now or timezone.now()
    n = 0
    for game in Game.objects.filter(status__in=PLAYED, live_version__isnull=False).select_related("live_version", "owner__user"):
        try:
            settle(game, now)
            warn_soon(game, now)
            n += 1
        except Exception:  # pylint: disable=broad-except
            import logging  # pylint: disable=import-outside-toplevel

            logging.getLogger(__name__).exception("Game Master tick failed for %s", game.pk)
    return n


def expire_now(actor, game_id, note: str = "") -> Game:
    """Bordino ends a game now (no grace): the same as its end coming."""
    if not is_reviewer(actor):
        raise GameMasterError("فقط بردینو این کار را می‌کند.", "forbidden")
    with transaction.atomic():
        game = Game.objects.select_for_update().filter(pk=game_id).first()
        if game is None:
            raise _not_found()
        if game.status not in LIVE:
            raise GameMasterError("این بازی الان باز نیست.", "not_published")
        now = timezone.now()
        Mystery.objects.filter(series=game.pk, edition=game.edition).update(ends_at=now, grace_ends_at=None, update_time=now)
        audit(game, actor, "admin_expire", note=note[:300])
    game.refresh_from_db()
    return settle(game, now + timedelta(microseconds=1))


def exclude_run(actor, run_id, note: str):
    """Bordino takes a player's run off a game's leaderboard (cheating, a dispute): audited; a
    frozen result gets a correcting snapshot (the old one is kept)."""
    if not is_reviewer(actor):
        raise GameMasterError("فقط بردینو این کار را می‌کند.", "forbidden")
    note = (note or "").strip()
    if not note:
        raise GameMasterError("دلیل را بنویسید.")
    run = MysteryRun.objects.select_related("mystery").filter(pk=run_id).first()
    if run is None:
        raise _not_found()
    game = Game.objects.filter(pk=run.mystery.series).first() if run.mystery.series else None
    snap = boards.exclude(run, actor, note)
    if game is not None:
        audit(game, actor, "leaderboard_exclude", run=str(run.pk), customer=str(run.customer_id), note=note[:300],
              snapshot=str(snap.pk) if snap else None)
    return snap


def check_upload_quota(p: CreatorProfile):
    from apps.gamemaster.models import GameAsset  # pylint: disable=import-outside-toplevel

    mine = GameAsset.objects.filter(owner=p)
    if mine.count() >= int(setting("GM_MAX_UPLOADS_TOTAL") or 500):
        raise GameMasterError("سقف تعداد تصویرهای تو پر شده است.", "limit")
    if mine.filter(create_time__gte=timezone.now() - timedelta(days=1)).count() >= int(setting("GM_MAX_UPLOADS_PER_DAY") or 60):
        raise GameMasterError("امروز تصویر زیادی بارگذاری کرده‌ای؛ فردا دوباره امتحان کن.", "limit")


# ── preview (nothing is recorded, nothing is paid) ──


@dataclass
class PreviewResult:
    ok: bool
    message: str = ""
    points: int = 0
    coupon: str = ""


def _preview_step(stage: dict, order: int) -> MysteryStep:
    fields = schema.compile_steps({"stages": [stage]})[0]
    fields.pop("clue_image")
    fields["order"] = order
    return MysteryStep(**fields)  # never saved


def preview(user, game_id, stage_id: str, data: dict) -> PreviewResult:
    """Checks one stage of the draft as the game would (answer, choice, code, location; a QR is
    taken as scanned). No run, check-in or payment is written."""
    game = owned(user, game_id)
    d = schema.clean(game.draft)
    stage = next((s for s in d["stages"] if s["id"] == str(stage_id)), None)
    if stage is None:
        raise GameMasterError("این مرحله پیدا نشد.", "not_found")
    step = _preview_step(stage, 1)
    data = data if isinstance(data, dict) else {}
    try:
        if step.proof == MysteryStep.Proof.GPS or step.check_location:
            if data.get("simulate_location") is True:
                pass  # the creator is not at the place: preview may skip the location
            else:
                engine.check_location(step, data)
        if step.proof in (MysteryStep.Proof.ANSWER, MysteryStep.Proof.CHOICE, MysteryStep.Proof.STAFF):
            given = str(data.get("code" if step.proof == MysteryStep.Proof.STAFF else "answer") or "")[:100]
            if not engine._matches(step, given):  # pylint: disable=protected-access
                noun = "کد" if step.proof == MysteryStep.Proof.STAFF else "پاسخ"
                return PreviewResult(False, f"{noun} درست نیست (در بازی واقعی، چند بار اشتباه یک وقفهٔ ۱۰ دقیقه‌ای دارد).")
    except engine.MissionError as exc:
        return PreviewResult(False, exc.message)
    return PreviewResult(True, "درست است.", stage.get("points") or 0, stage.get("coupon") or "")


def public_base() -> str:
    return getattr(settings, "MISSIONS_PUBLIC_URL", "").rstrip("/")
