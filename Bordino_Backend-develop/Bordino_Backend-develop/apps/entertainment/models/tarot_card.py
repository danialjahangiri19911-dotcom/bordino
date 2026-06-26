from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.django_helper.models.base import AbstractBaseModel


class TarotCard(AbstractBaseModel):
    """یک کارتِ تاروت (آرکانای بزرگ) با نام، نماد و تفسیر."""

    order = models.PositiveSmallIntegerField(
        verbose_name=_("Order"), unique=True, help_text=_("شماره‌ی کارت در دسته (۰ تا ۲۱)")
    )
    name = models.CharField(verbose_name=_("Name"), max_length=100)
    # نمادِ کوتاه (اموجی) برای نمایش روی کارتِ طراحی‌شده با CSS
    symbol = models.CharField(verbose_name=_("Symbol"), max_length=8, blank=True)
    interpretation = models.TextField(verbose_name=_("Interpretation"))

    class Meta(AbstractBaseModel.Meta):
        verbose_name = _("Tarot Card")
        verbose_name_plural = _("Tarot Cards")
        ordering = ["order"]

    def __str__(self):
        return f"{self.order} - {self.name}"
