"""Pantomime («پانتومیم»): a party game played on one phone, passed around a room. The clues of
its two ready-made modes are kept here (the admin edits them), with the game's limits and the
finished games of each player. It is free: nothing here moves points (the scores are typed in by
the players, so they never pay)."""

from decimal import Decimal

from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Q
from django.utils.translation import gettext_lazy as _

from apps.django_helper.models.base import AbstractBaseModel

# The game's own bounds (the app's engine checks the same): the admin chooses within them.
SECONDS_RANGE = (10, 900)
ROUNDS_RANGE = (1, 10)
TEAMS_RANGE = (2, 6)
MEMBERS_RANGE = (2, 12)

# Icons the app can draw for a topic (its Lucide set).
ICONS = [
    "coffee", "paw-print", "briefcase", "bike", "clapperboard", "message-circle", "music", "heart", "star",
    "smile", "book-open", "globe", "utensils", "car", "sun", "gamepad-2", "map-pin", "palette", "drama",
]


class PantomimeSettings(AbstractBaseModel):
    """The game's switch and limits (one row; the first is used)."""

    class Meta(AbstractBaseModel.Meta):
        verbose_name = _("تنظیمات پانتومیم")
        verbose_name_plural = _("تنظیمات پانتومیم")

    enabled = models.BooleanField(default=True, verbose_name=_("فعال"), help_text=_("خاموش: بازی در اپ شروع نمی‌شود."))
    min_turn_seconds = models.PositiveSmallIntegerField(
        default=30, validators=[MinValueValidator(30), MaxValueValidator(900)], verbose_name=_("کمترین زمان نوبت (ثانیه)"),
        help_text=_("برای «تک‌کلمه‌ای نوبتی» و «رکورد در زمان»؛ ۳۰ تا ۹۰۰."),
    )
    max_turn_seconds = models.PositiveSmallIntegerField(
        default=900, validators=[MinValueValidator(30), MaxValueValidator(900)], verbose_name=_("بیشترین زمان نوبت (ثانیه)")
    )
    min_challenge_seconds = models.PositiveSmallIntegerField(
        default=10, validators=[MinValueValidator(10), MaxValueValidator(900)], verbose_name=_("کمترین زمان چالش (ثانیه)"),
        help_text=_("زمانی که تیم‌ها در «چالش با کارت‌های خودتان» پیشنهاد می‌دهند؛ ۱۰ تا ۹۰۰."),
    )
    max_challenge_seconds = models.PositiveSmallIntegerField(
        default=900, validators=[MinValueValidator(10), MaxValueValidator(900)], verbose_name=_("بیشترین زمان چالش (ثانیه)")
    )
    max_rounds = models.PositiveSmallIntegerField(
        default=10, validators=[MinValueValidator(1), MaxValueValidator(10)], verbose_name=_("بیشترین تعداد دور")
    )
    max_teams = models.PositiveSmallIntegerField(
        default=6, validators=[MinValueValidator(2), MaxValueValidator(6)], verbose_name=_("بیشترین تعداد تیم")
    )
    max_members = models.PositiveSmallIntegerField(
        default=12, validators=[MinValueValidator(2), MaxValueValidator(12)], verbose_name=_("بیشترین تعداد عضو هر تیم")
    )

    def clean(self):
        super().clean()
        errors = {}
        if self.min_turn_seconds > self.max_turn_seconds:
            errors["max_turn_seconds"] = _("بیشترین زمان نوبت نباید از کمترین کمتر باشد.")
        if self.min_challenge_seconds > self.max_challenge_seconds:
            errors["max_challenge_seconds"] = _("بیشترین زمان چالش نباید از کمترین کمتر باشد.")
        if errors:
            raise ValidationError(errors)

    @classmethod
    def current(cls) -> "PantomimeSettings":
        return cls.objects.order_by("create_time").first() or cls.objects.create()

    def __str__(self):
        return str(_("تنظیمات پانتومیم"))


class PantomimeCategory(AbstractBaseModel):
    """A topic of ready-made clues (روزمره، حیوانات…)."""

    class Meta(AbstractBaseModel.Meta):
        verbose_name = _("موضوع پانتومیم")
        verbose_name_plural = _("موضوع‌های پانتومیم")
        ordering = ("order", "create_time")

    slug = models.SlugField(max_length=30, unique=True, verbose_name=_("شناسه"), help_text=_("انگلیسی، بدون فاصله؛ مثلاً food."))
    name = models.CharField(max_length=40, verbose_name=_("نام"))
    icon = models.CharField(max_length=30, choices=[(i, i) for i in ICONS], default="drama", verbose_name=_("آیکون"))
    weight = models.DecimalField(
        max_digits=3, decimal_places=1, default=Decimal("1.0"),
        validators=[MinValueValidator(Decimal("0.5")), MaxValueValidator(Decimal("3.0"))],
        verbose_name=_("ضریب امتیاز"),
        help_text=_("در «تک‌کلمه‌ای نوبتی»: امتیاز پایه = سختی (۱۰۰/۲۰۰/۳۰۰) × این ضریب. فقط امتیاز داخل بازی است."),
    )
    order = models.PositiveSmallIntegerField(default=0, verbose_name=_("ترتیب"))
    is_active = models.BooleanField(default=True, verbose_name=_("فعال"))

    def __str__(self):
        return self.name


class PantomimeCard(AbstractBaseModel):
    """One clue: a word or phrase to act out."""

    class Difficulty(models.IntegerChoices):
        EASY = 1, _("آسان")
        MEDIUM = 2, _("متوسط")
        HARD = 3, _("سخت")

    class Meta(AbstractBaseModel.Meta):
        verbose_name = _("کارت پانتومیم")
        verbose_name_plural = _("کارت‌های پانتومیم")
        ordering = ("category__order", "difficulty", "text")
        constraints = [models.UniqueConstraint(fields=("category", "text"), name="pantomime_card_unique_text")]

    category = models.ForeignKey(PantomimeCategory, on_delete=models.CASCADE, related_name="cards", verbose_name=_("موضوع"))
    difficulty = models.PositiveSmallIntegerField(choices=Difficulty.choices, default=Difficulty.EASY, verbose_name=_("سختی"))
    text = models.CharField(max_length=120, verbose_name=_("متن کارت"))
    is_active = models.BooleanField(default=True, verbose_name=_("فعال"))

    def clean(self):
        super().clean()
        self.text = " ".join((self.text or "").split())
        if not self.text:
            raise ValidationError({"text": _("متن کارت خالی است.")})

    def __str__(self):
        return self.text


class PantomimeGame(AbstractBaseModel):
    """A finished game, as the app reports it: the player's own record (no points move)."""

    class Format(models.TextChoices):
        CHALLENGE = "challenge", _("چالش با کارت‌های خودتان")
        DUEL = "duel", _("تک‌کلمه‌ای نوبتی")
        MARATHON = "marathon", _("رکورد در زمان")

    class Mode(models.TextChoices):
        CLASSIC = "classic", _("یک نفر اجرا، تیم حدس")
        REVERSE = "reverse", _("همه اجرا، یک نفر حدس")

    class Meta(AbstractBaseModel.Meta):
        verbose_name = _("بازی پانتومیم")
        verbose_name_plural = _("بازی‌های پانتومیم")
        ordering = ("-create_time",)
        indexes = [models.Index(fields=["customer", "-create_time"], name="pantomime_customer_recent")]
        constraints = [
            models.UniqueConstraint(
                fields=("customer", "request_id"), condition=Q(request_id__isnull=False), name="pantomime_game_unique_request"
            )
        ]

    customer = models.ForeignKey("users.Customer", on_delete=models.CASCADE, related_name="pantomime_games", verbose_name=_("بازیکن"))
    # One id per finished game the app reports; a resend after a lost answer is the same game.
    request_id = models.CharField(max_length=64, null=True, blank=True, editable=False)
    format = models.CharField(max_length=20, choices=Format.choices, verbose_name=_("حالت"))
    mode = models.CharField(max_length=20, choices=Mode.choices, verbose_name=_("روش اجرا"))
    rounds = models.PositiveSmallIntegerField(verbose_name=_("دورها"))
    team_count = models.PositiveSmallIntegerField(verbose_name=_("تیم‌ها"))
    winners = models.CharField(max_length=200, blank=True, verbose_name=_("برنده"))
    # [{name, members, score, rank, correct, correct_elapsed_ms}], in the game's team order.
    teams = models.JSONField(default=list, blank=True, verbose_name=_("تیم‌ها و امتیازها"))
    # The turns as played ({team (index into teams), round, player, points, cards_total, cards: [{text,
    # result, elapsed_ms}] — the first 200}), for the record.
    turns = models.JSONField(default=list, blank=True, verbose_name=_("نوبت‌ها"))

    def __str__(self):
        return f"{self.get_format_display()} · {self.winners}"
