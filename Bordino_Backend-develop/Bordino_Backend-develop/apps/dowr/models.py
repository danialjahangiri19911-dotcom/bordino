"""«دُور»: a face-to-face word-guessing game for teams of two, played on one phone. The game itself runs
in the app (its own engine: turns, timers, the bomb, scoring); the server keeps what Bordino edits —
the switch, the limits, the topics and the cards (with their forbidden words) — and each player's
finished games, as the app reports them. No points or money move."""

from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q
from django.utils.translation import gettext_lazy as _

from apps.django_helper.models.base import AbstractBaseModel

TEAMS_RANGE = (2, 6)
ROUNDS = (1, 3, 5, 7, 10)
SECONDS = (15, 20, 30, 45, 60, 90, 120, 180, 300, 600)
HANDOFF = (0, 1, 2, 3, 5, 10, 15, 30)
BOMB_SECONDS = (10, 600)
BOMB_PENALTIES = (100, 250, 500, 1000, 2000)
# The icons a topic may show (the app's icon set).
ICONS = ("coffee", "utensils", "leaf", "briefcase", "gamepad-2", "map-pin", "music", "book-open", "heart", "star", "sparkles", "landmark", "car", "smile", "flame", "globe", "house", "camera", "paw-print", "trophy")


class DowrSettings(AbstractBaseModel):
    """One row: the game's switch and what players may choose."""

    class Meta(AbstractBaseModel.Meta):
        verbose_name = _("تنظیمات دُور")
        verbose_name_plural = _("تنظیمات دُور")

    enabled = models.BooleanField(default=True, verbose_name=_("فعال"), help_text=_("خاموش: بازی در اپ شروع نمی‌شود."))
    bomb_allowed = models.BooleanField(default=True, verbose_name=_("بمب دست‌به‌دست مجاز"))
    max_rounds = models.PositiveSmallIntegerField(default=10, verbose_name=_("بیشترین دور"), help_text=_("از ۱، ۳، ۵، ۷ یا ۱۰."))
    max_seconds = models.PositiveSmallIntegerField(default=600, verbose_name=_("بیشترین زمان هر لغت (ثانیه)"))

    def clean(self):
        super().clean()
        if self.max_rounds not in ROUNDS:
            raise ValidationError({"max_rounds": _("یکی از ۱، ۳، ۵، ۷ یا ۱۰.")})
        if self.max_seconds not in SECONDS:
            raise ValidationError({"max_seconds": _("یکی از زمان‌های بازی (۱۵ تا ۶۰۰ ثانیه).")})

    def __str__(self):
        return "تنظیمات دُور"

    @classmethod
    def current(cls) -> "DowrSettings":
        return cls.objects.order_by("create_time").first() or cls()


class DowrCategory(AbstractBaseModel):
    class Meta(AbstractBaseModel.Meta):
        verbose_name = _("موضوع دُور")
        verbose_name_plural = _("موضوع‌های دُور")
        ordering = ("order", "name")

    slug = models.SlugField(max_length=30, unique=True, verbose_name=_("شناسه"), help_text=_("انگلیسی، بدون فاصله؛ مثلاً food."))
    name = models.CharField(max_length=40, verbose_name=_("نام"))
    icon = models.CharField(max_length=30, choices=[(i, i) for i in ICONS], default="sparkles", verbose_name=_("آیکون"))
    order = models.PositiveSmallIntegerField(default=0, verbose_name=_("ترتیب"))
    is_active = models.BooleanField(default=True, verbose_name=_("فعال"))

    def __str__(self):
        return self.name


class DowrCard(AbstractBaseModel):
    """A word to explain, and (for «کلمات ممنوعه») the three words that may not be said."""

    class Difficulty(models.IntegerChoices):
        EASY = 1, _("آسان")
        HARD = 2, _("چالشی")

    class Meta(AbstractBaseModel.Meta):
        verbose_name = _("کارت دُور")
        verbose_name_plural = _("کارت‌های دُور")
        ordering = ("category__order", "difficulty", "text")
        constraints = [models.UniqueConstraint(fields=("category", "text"), name="dowr_card_unique_text")]

    category = models.ForeignKey(DowrCategory, on_delete=models.CASCADE, related_name="cards", verbose_name=_("موضوع"))
    difficulty = models.PositiveSmallIntegerField(choices=Difficulty.choices, default=Difficulty.EASY, verbose_name=_("سختی"))
    text = models.CharField(max_length=60, verbose_name=_("کلمه"))
    forbidden = models.CharField(
        max_length=120, verbose_name=_("کلمات ممنوعه"), help_text=_("سه کلمه با ویرگول فارسی (،) جدا شده؛ مثلاً: دندان،خمیر،دهان")
    )
    is_active = models.BooleanField(default=True, verbose_name=_("فعال"))

    def forbidden_list(self) -> list[str]:
        return [w.strip() for w in self.forbidden.replace(",", "،").split("،") if w.strip()]

    def clean(self):
        super().clean()
        words = self.forbidden_list()
        if len(words) != 3:
            raise ValidationError({"forbidden": _("دقیقاً سه کلمهٔ ممنوعه بنویسید (با ، جدا).")})
        if self.text.strip() in words:
            raise ValidationError({"forbidden": _("خود کلمه نمی‌تواند ممنوعه باشد.")})

    def __str__(self):
        return self.text


class DowrGame(AbstractBaseModel):
    """A finished game, as the app reports it: the player's own record (no points move)."""

    class Mode(models.TextChoices):
        CLASSIC = "classic", _("دور کلاسیک")
        TABOO = "taboo", _("کلمات ممنوعه")

    class Meta(AbstractBaseModel.Meta):
        verbose_name = _("بازی دُور")
        verbose_name_plural = _("بازی‌های دُور")
        ordering = ("-create_time",)
        indexes = [models.Index(fields=["customer", "-create_time"], name="dowr_customer_recent")]
        constraints = [
            models.UniqueConstraint(fields=("customer", "request_id"), condition=Q(request_id__isnull=False), name="dowr_game_unique_request")
        ]

    customer = models.ForeignKey("users.Customer", on_delete=models.CASCADE, related_name="dowr_games", verbose_name=_("بازیکن"))
    # One id per finished game the app reports; a resend after a lost answer is the same game.
    request_id = models.CharField(max_length=64, null=True, blank=True, editable=False)
    mode = models.CharField(max_length=10, choices=Mode.choices, verbose_name=_("حالت"))
    rounds = models.PositiveSmallIntegerField(verbose_name=_("دورها"))
    seconds = models.PositiveSmallIntegerField(verbose_name=_("زمان هر لغت (ثانیه)"))
    team_count = models.PositiveSmallIntegerField(verbose_name=_("تیم‌ها"))
    bomb = models.JSONField(default=dict, blank=True, verbose_name=_("بمب"))
    winners = models.CharField(max_length=200, blank=True, verbose_name=_("برنده"))
    # [{name, members, score, rank, correct}] in the game's team order.
    teams = models.JSONField(default=list, blank=True, verbose_name=_("تیم‌ها و امتیازها"))
    # The answers as played ({round, team, player, text, kind, points, elapsed_ms}) — the first 600.
    log = models.JSONField(default=list, blank=True, verbose_name=_("نوبت‌ها"))

    def __str__(self):
        return f"{self.get_mode_display()} · {self.winners}"
