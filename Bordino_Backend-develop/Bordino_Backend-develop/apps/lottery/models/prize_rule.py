from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.lottery.models import Lottery


class PrizeRule(models.Model):
    class Meta:
        unique_together = ("lottery", "match_count")
        verbose_name = _("Prize Rule")
        verbose_name_plural = _("Prize Rules")

    lottery = models.ForeignKey(
        Lottery,
        null=False,
        blank=False,
        on_delete=models.CASCADE,
        related_name="prize_rules",
    )
    match_count = models.PositiveSmallIntegerField(
        verbose_name=_("Match Count"), null=False, blank=False
    )
    prize_amount = models.DecimalField(
        verbose_name=_("Prize Amount"),
        null=False,
        blank=False,
        max_digits=10,
        decimal_places=2,
    )

    def __str__(self):
        return f"lottery {self.lottery}, {self.match_count} matches: {self.prize_amount} Toman"
