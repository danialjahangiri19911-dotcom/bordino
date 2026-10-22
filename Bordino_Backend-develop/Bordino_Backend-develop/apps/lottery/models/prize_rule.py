from django.core.validators import MinValueValidator
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.lottery.models import Lottery


class PrizeRule(models.Model):
    class Meta:
        unique_together = ("lottery", "match_count")
        verbose_name = _("Prize Rule")
        verbose_name_plural = _("Prize Rules")
        constraints = [
            models.CheckConstraint(
                condition=models.Q(prize_amount__gte=0), name="prize_rule_not_negative"
            )
        ]

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
        # A negative prize would take money from the winner.
        validators=[MinValueValidator(0)],
    )

    def __str__(self):
        return f"lottery {self.lottery}, {self.match_count} matches: {self.prize_amount} Toman"

    def save(self, *args, **kwargs):
        # A plain models.Model: validate here too (a negative prize would take money from the winner).
        self.full_clean()
        super().save(*args, **kwargs)
