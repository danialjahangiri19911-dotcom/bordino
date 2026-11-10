"""«جاسوس»: a face-to-face party game on one phone (Bordino-Spy-UI-Design 1.0.6). The game itself runs in
the app (its own engine: roles, private cards, the timer, voting); the server keeps what Bordino edits —
the switch, the topics and the word bank (each word with its «related» word for the infiltrator mode, its
difficulty and the youngest age it suits). Players' own words and results stay on their phone; no points
or money move."""

from django.core.exceptions import ValidationError
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.django_helper.models.base import AbstractBaseModel

# The icons a topic may show (the app's icon set).
ICONS = (
    "map-pin", "paw-print", "utensils", "briefcase-business", "lamp", "clapperboard", "volleyball", "cpu", "car",
    "user-round", "landmark", "flask-conical", "flower-2", "puzzle", "sparkles", "folder", "music", "book-open",
    "gem", "heart", "star", "smile", "globe", "house", "camera", "trophy",
)
AGES = (7, 12, 18)
MARKUP = set("<>&\"'`")


def no_markup(value: str, field: str):
    if any(ch in MARKUP for ch in value or ""):
        raise ValidationError({field: _("نوشته نمی‌تواند < > & \" ' ` داشته باشد.")})


class SpySettings(AbstractBaseModel):
    """One row: the game's switch."""

    class Meta(AbstractBaseModel.Meta):
        verbose_name = _("تنظیمات جاسوس")
        verbose_name_plural = _("تنظیمات جاسوس")

    enabled = models.BooleanField(default=True, verbose_name=_("فعال"), help_text=_("خاموش: بازی در اپ شروع نمی‌شود."))
    adults_allowed = models.BooleanField(
        default=True, verbose_name=_("کلمه‌های بزرگسال"), help_text=_("خاموش: کلمه‌های مناسب ۱۸ سال به بالا در بازی نمی‌آیند.")
    )

    def __str__(self):
        return "تنظیمات جاسوس"

    @classmethod
    def current(cls) -> "SpySettings":
        return cls.objects.order_by("create_time").first() or cls()


class SpyCategory(AbstractBaseModel):
    class Meta(AbstractBaseModel.Meta):
        verbose_name = _("موضوع جاسوس")
        verbose_name_plural = _("موضوع‌های جاسوس")
        ordering = ("order", "name")

    slug = models.SlugField(max_length=30, unique=True, verbose_name=_("شناسه"), help_text=_("انگلیسی، بدون فاصله؛ مثلاً places."))
    name = models.CharField(max_length=40, verbose_name=_("نام"))
    icon = models.CharField(max_length=30, choices=[(i, i) for i in ICONS], default="folder", verbose_name=_("آیکون"))
    order = models.PositiveSmallIntegerField(default=0, verbose_name=_("ترتیب"))
    is_active = models.BooleanField(default=True, verbose_name=_("فعال"))

    def clean(self):
        super().clean()
        # The topic name is shown inside the game's markup: plain words only.
        no_markup(self.name, "name")

    def __str__(self):
        return self.name


class SpyWord(AbstractBaseModel):
    """A word the citizens see, and (for «نفوذی») a related word the infiltrator sees instead."""

    class Difficulty(models.IntegerChoices):
        EASY = 1, _("آسان")
        HARD = 2, _("چالشی")

    class Meta(AbstractBaseModel.Meta):
        verbose_name = _("کلمهٔ جاسوس")
        verbose_name_plural = _("کلمه‌های جاسوس")
        ordering = ("category__order", "difficulty", "text")
        constraints = [models.UniqueConstraint(fields=("category", "text"), name="spy_word_unique_text")]

    category = models.ForeignKey(SpyCategory, on_delete=models.CASCADE, related_name="words", verbose_name=_("موضوع"))
    text = models.CharField(max_length=80, verbose_name=_("کلمه"))
    related = models.CharField(max_length=80, blank=True, verbose_name=_("کلمهٔ مشابه (برای نفوذی)"))
    difficulty = models.PositiveSmallIntegerField(choices=Difficulty.choices, default=Difficulty.EASY, verbose_name=_("سختی"))
    age = models.PositiveSmallIntegerField(choices=[(a, f"{a}+") for a in AGES], default=7, verbose_name=_("مناسب سن"))
    is_active = models.BooleanField(default=True, verbose_name=_("فعال"))

    def clean(self):
        super().clean()
        if self.related and self.related.strip() == self.text.strip():
            raise ValidationError({"related": _("کلمهٔ مشابه نباید خود کلمه باشد.")})

    def __str__(self):
        return self.text
