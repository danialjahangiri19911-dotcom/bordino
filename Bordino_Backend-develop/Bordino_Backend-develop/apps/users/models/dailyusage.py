from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.django_helper.models.base import AbstractBaseModel


class DailyUsage(AbstractBaseModel):
    class Meta(AbstractBaseModel.Meta):
        verbose_name = _("Daily usage")
        verbose_name_plural = _("Daily usages")

    class UsageChoices(models.TextChoices):
        UNKNOWN = "Unknown", _("Unknown")
        NORMAL = "Normal", _("Normal")
        MODERATE = "Moderate", _("Moderate")
        HIGH = "High", _("High")

    usage_duration_per_day = models.CharField(
        verbose_name=_("daily usage duration"),
        max_length=8,
        choices=UsageChoices.choices,
        default=UsageChoices.UNKNOWN,
    )
    reward_points = models.IntegerField(verbose_name=_("reward points"), default=0)

    def __str__(self):
        return self.usage_duration_per_day
