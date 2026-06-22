from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.django_helper.models.base import AbstractBaseModel


class FortuneReading(AbstractBaseModel):
    class ReadingType(models.TextChoices):
        HAFEZ = "hafez", _("Hafez")
        # Add more types as needed in the future
        # TAROT = "tarot", _("Tarot")
        # COIN = "coin", _("Coin Reading")

    type = models.CharField(
        verbose_name=_("Type"),
        max_length=50,
        choices=ReadingType.choices,
        default=ReadingType.HAFEZ,
    )
    question = models.TextField(
        verbose_name=_("Question"),
        blank=True,
        null=True,
        help_text=_("The question or query for the fortune reading"),
    )
    result = models.TextField(
        verbose_name=_("Result"),
        blank=True,
        null=True,
        help_text=_("The fortune reading result or interpretation"),
    )

    def __str__(self):
        return f"{self.id} - {self.type} - {self.create_time}"
