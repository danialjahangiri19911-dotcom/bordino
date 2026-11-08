"""Game Master: games made by players (creators), reviewed by Bordino, played as «معمای شهری».

A creator edits a game's draft (a JSON definition, schema.py). Submitting freezes the draft as a
GameVersion, which never changes again; an admin reviews that exact version. An approved version is
published by compiling it into a Mystery (apps.missions), so players play it with the same engine,
listing and checks as Bordino's own mysteries. The creator funds the players' points: a budget
reserved from the creator's points wallet when the game is published (GameBudgetLedger).
"""

import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.django_helper.models.base import AbstractBaseModel


class CreatorProfile(AbstractBaseModel):
    """A user's creator side (the same account: a player stays a player)."""

    class Intent(models.TextChoices):
        PERSONAL = "personal", _("شخصی")
        BUSINESS = "business", _("کسب‌وکار")
        PRO = "pro", _("سازندهٔ حرفه‌ای")

    class Mode(models.TextChoices):
        PLAYER = "player", _("بازیکن")
        CREATOR = "creator", _("گیم مستر")

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="creator_profile")
    intent = models.CharField(max_length=10, choices=Intent.choices, blank=True, verbose_name=_("کاربرد"))
    terms_version = models.CharField(max_length=20, blank=True)
    terms_accepted_at = models.DateTimeField(null=True, blank=True, verbose_name=_("پذیرش قوانین"))
    preferred_mode = models.CharField(max_length=10, choices=Mode.choices, default=Mode.PLAYER, verbose_name=_("حالت برنامه"))
    business_name = models.CharField(max_length=120, blank=True, verbose_name=_("نام کسب‌وکار یا سازنده"))
    business_phone = models.CharField(max_length=20, blank=True, verbose_name=_("تلفن کسب‌وکار"))
    is_blocked = models.BooleanField(
        default=False, verbose_name=_("مسدود"), help_text=_("سازندهٔ مسدود نمی‌تواند بازی بسازد یا بفرستد.")
    )

    class Meta(AbstractBaseModel.Meta):
        verbose_name = _("سازنده")
        verbose_name_plural = _("سازنده‌ها")

    def __str__(self):
        return self.business_name or str(self.user)

    @property
    def onboarded(self) -> bool:
        return bool(self.terms_accepted_at and self.intent)


class Game(AbstractBaseModel):
    class Category(models.TextChoices):
        BUSINESS = "business", _("کسب‌وکار")
        PERSONAL = "personal", _("شخصی")
        PRO = "pro", _("حرفه‌ای")

    class Status(models.TextChoices):
        DRAFT = "draft", _("پیش‌نویس")
        SUBMITTED = "submitted", _("در انتظار بررسی")
        CHANGES_REQUESTED = "changes_requested", _("نیاز به اصلاح")
        APPROVED = "approved", _("تأییدشده، آمادهٔ انتشار")
        REJECTED = "rejected", _("ردشده")
        SCHEDULED = "scheduled", _("زمان‌بندی‌شده")
        PUBLISHED = "published", _("منتشرشده")
        PAUSED = "paused", _("متوقف")
        # Its end came: nobody new joins (players may finish within its grace); history is kept and
        # a new version (an extension) or a new edition can open it again after review.
        EXPIRED = "expired", _("به پایان رسیده")
        ARCHIVED = "archived", _("بایگانی")

    owner = models.ForeignKey(CreatorProfile, on_delete=models.PROTECT, related_name="games", verbose_name=_("سازنده"))
    category = models.CharField(max_length=10, choices=Category.choices, verbose_name=_("نوع"))
    template = models.CharField(max_length=40, blank=True, verbose_name=_("قالب"))
    title = models.CharField(max_length=120, blank=True, verbose_name=_("عنوان"))
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT, verbose_name=_("وضعیت"))
    # The creator's working copy; versions are frozen copies of it.
    draft = models.JSONField(default=dict, blank=True)
    draft_saved_at = models.DateTimeField(null=True, blank=True)
    # The version players see (its Mystery), and one waiting for review or publication, if any.
    live_version = models.ForeignKey(
        "GameVersion", on_delete=models.PROTECT, null=True, blank=True, related_name="+", verbose_name=_("نسخهٔ منتشرشده")
    )
    paused_by_admin = models.BooleanField(default=False, verbose_name=_("توقف توسط ادمین"))
    # A private game's invite: made once (shown from the first draft), the same for every version;
    # it opens the game once a version is published.
    invite_token = models.CharField(max_length=64, unique=True, null=True, blank=True, editable=False)
    # The edition being played: a new edition has its own players and leaderboard.
    edition = models.PositiveSmallIntegerField(default=1, verbose_name=_("دوره"))

    class Meta(AbstractBaseModel.Meta):
        verbose_name = _("بازی سازنده")
        verbose_name_plural = _("بازی‌های سازندگان")
        indexes = [models.Index(fields=["owner", "status"], name="gm_game_owner_status")]

    def __str__(self):
        return self.title or str(self.pk)


class GameVersion(AbstractBaseModel):
    """One submitted copy of a game: never changes after it is created (reviewed and played as is)."""

    class Status(models.TextChoices):
        SUBMITTED = "submitted", _("در انتظار بررسی")
        CHANGES_REQUESTED = "changes_requested", _("نیاز به اصلاح")
        APPROVED = "approved", _("تأییدشده")
        REJECTED = "rejected", _("ردشده")
        PUBLISHED = "published", _("منتشرشده")
        SUPERSEDED = "superseded", _("جایگزین‌شده")

    game = models.ForeignKey(Game, on_delete=models.PROTECT, related_name="versions", verbose_name=_("بازی"))
    number = models.PositiveIntegerField(verbose_name=_("نسخه"))
    definition = models.JSONField(verbose_name=_("تعریف بازی"))
    schema_version = models.PositiveSmallIntegerField(default=1)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.SUBMITTED, verbose_name=_("وضعیت"))
    submitted_at = models.DateTimeField(auto_now_add=True, verbose_name=_("زمان ارسال"))
    reviewed_at = models.DateTimeField(null=True, blank=True, verbose_name=_("زمان بررسی"))
    reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+", verbose_name=_("بررسی‌کننده")
    )
    review_note = models.TextField(blank=True, verbose_name=_("پیام بررسی"), help_text=_("سازنده این پیام را می‌بیند."))
    # Set when approved, from the prices then in force (a later price change does not touch it).
    fee_toman = models.PositiveIntegerField(default=0, verbose_name=_("هزینهٔ انتشار (تومان)"))
    fee_paid = models.BooleanField(default=False, verbose_name=_("هزینه پرداخت شد"))
    published_at = models.DateTimeField(null=True, blank=True, verbose_name=_("زمان انتشار"))

    class Meta(AbstractBaseModel.Meta):
        verbose_name = _("نسخهٔ بازی")
        verbose_name_plural = _("نسخه‌های بازی (بررسی)")
        ordering = ("-submitted_at",)
        constraints = [models.UniqueConstraint(fields=("game", "number"), name="gm_version_number")]
        permissions = [("review_game", "Can review and approve creator games")]

    def __str__(self):
        return f"{self.game} — نسخهٔ {self.number}"

    def save(self, *args, **kwargs):
        # Immutable: what was reviewed is what players get.
        if not self._state.adding:
            before = GameVersion.objects.filter(pk=self.pk).values_list("definition", "game_id", "number").first()
            if before and (before[0] != self.definition or before[1] != self.game_id or before[2] != self.number):
                raise ValidationError(_("نسخهٔ فرستاده‌شده تغییر نمی‌کند؛ نسخهٔ تازه بفرستید."))
        return super().save(*args, **kwargs)


class GameReview(AbstractBaseModel):
    """One reviewer decision on one version (the history; the version keeps the latest)."""

    class Decision(models.TextChoices):
        APPROVE = "approve", _("تأیید")
        REJECT = "reject", _("رد")
        CHANGES = "changes", _("درخواست اصلاح")

    version = models.ForeignKey(GameVersion, on_delete=models.PROTECT, related_name="reviews")
    reviewer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    decision = models.CharField(max_length=10, choices=Decision.choices)
    note = models.TextField(blank=True)

    class Meta(AbstractBaseModel.Meta):
        verbose_name = _("بررسی")
        verbose_name_plural = _("بررسی‌ها")


class GameAuditLog(AbstractBaseModel):
    """Every important action on creator games (who, what, when)."""

    game = models.ForeignKey(Game, on_delete=models.SET_NULL, null=True, blank=True, related_name="audit", verbose_name=_("بازی"))
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+", verbose_name=_("انجام‌دهنده")
    )
    action = models.CharField(max_length=40, verbose_name=_("کار"))
    data = models.JSONField(default=dict, blank=True)

    class Meta(AbstractBaseModel.Meta):
        verbose_name = _("رویداد")
        verbose_name_plural = _("گزارش رویدادها")
        indexes = [models.Index(fields=["game", "create_time"], name="gm_audit_game")]

    def __str__(self):
        return f"{self.action} — {self.game_id}"


class GameBudgetLedger(AbstractBaseModel):
    """The creator's points set aside for a game's players: reserved at publication, spent per
    payout, the rest released when the game ends. Each entry once (its key)."""

    class Kind(models.TextChoices):
        RESERVE = "reserve", _("کنار گذاشتن")
        SPEND = "spend", _("پرداخت به بازیکن")
        RELEASE = "release", _("برگشت باقی‌مانده")

    game = models.ForeignKey(Game, on_delete=models.PROTECT, related_name="ledger")
    version = models.ForeignKey(GameVersion, on_delete=models.PROTECT, related_name="ledger")
    kind = models.CharField(max_length=10, choices=Kind.choices)
    points = models.PositiveIntegerField()
    key = models.CharField(max_length=80, unique=True)
    activity_transaction = models.OneToOneField(
        "wallet.ActivityTransaction", on_delete=models.PROTECT, null=True, blank=True, related_name="gm_ledger"
    )

    class Meta(AbstractBaseModel.Meta):
        verbose_name = _("دفتر بودجه")
        verbose_name_plural = _("دفتر بودجهٔ بازی‌ها")


def gm_upload(instance, filename):
    return f"gm/{uuid.uuid4().hex}.{filename.rsplit('.', 1)[-1].lower() if '.' in filename else 'jpg'}"


class GameAsset(AbstractBaseModel):
    """An image a creator uploaded for a game (checked as a real image; never replaced)."""

    owner = models.ForeignKey(CreatorProfile, on_delete=models.PROTECT, related_name="assets")
    image = models.ImageField(upload_to=gm_upload)

    class Meta(AbstractBaseModel.Meta):
        verbose_name = _("تصویر سازنده")
        verbose_name_plural = _("تصاویر سازندگان")


class GamePayment(AbstractBaseModel):
    """A creator's payment through Zibal (a publication fee): one per trackId, confirmed once."""

    class Status(models.TextChoices):
        PENDING = "pending", _("در انتظار پرداخت")
        PAID = "paid", _("پرداخت شد")
        FAILED = "failed", _("ناموفق")

    class Purpose(models.TextChoices):
        FEE = "fee", _("هزینهٔ انتشار")

    creator = models.ForeignKey(CreatorProfile, on_delete=models.PROTECT, related_name="payments", verbose_name=_("سازنده"))
    game = models.ForeignKey(Game, on_delete=models.PROTECT, related_name="payments", verbose_name=_("بازی"))
    version = models.ForeignKey(GameVersion, on_delete=models.PROTECT, related_name="payments", verbose_name=_("نسخه"))
    purpose = models.CharField(max_length=10, choices=Purpose.choices, default=Purpose.FEE, verbose_name=_("برای"))
    amount_toman = models.PositiveIntegerField(verbose_name=_("مبلغ (تومان)"))
    track_id = models.CharField(max_length=64, unique=True, verbose_name=_("شناسهٔ زیبال"))
    mode = models.CharField(max_length=10, verbose_name=_("حالت درگاه"), help_text=_("sandbox = آزمایشی، بدون جابه‌جایی پول."))
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING, verbose_name=_("وضعیت"))
    ref_number = models.CharField(max_length=64, blank=True, verbose_name=_("شمارهٔ پیگیری"))
    card = models.CharField(max_length=32, blank=True, verbose_name=_("کارت"))
    verified_at = models.DateTimeField(null=True, blank=True, verbose_name=_("زمان تأیید"))

    class Meta(AbstractBaseModel.Meta):
        verbose_name = _("پرداخت سازنده")
        verbose_name_plural = _("پرداخت‌های سازندگان")

    def __str__(self):
        return f"{self.game} — {self.amount_toman} تومان ({self.get_status_display()})"


class GameNotice(AbstractBaseModel):
    """A one-time event of a game (a notice sent, a result frozen): its key is used once, so a
    timer that runs again (or twice at once) never repeats it."""

    game = models.ForeignKey(Game, on_delete=models.CASCADE, related_name="notices")
    key = models.CharField(max_length=120, unique=True)

    class Meta(AbstractBaseModel.Meta):
        verbose_name = _("رویداد بازی")
        verbose_name_plural = _("رویدادهای بازی‌ها")
