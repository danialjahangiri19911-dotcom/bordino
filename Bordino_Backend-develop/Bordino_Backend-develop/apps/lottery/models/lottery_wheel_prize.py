from django.core.validators import MaxValueValidator
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.lottery.models import LotteryWheel


class LotteryWheelPrize(models.Model):
    class Meta:
        unique_together = ("lottery_wheel", "name")
        verbose_name = _("Lottery Wheel Prize")
        verbose_name_plural = _("Lottery Wheel Prizes")

    class PrizeType(models.TextChoices):
        CASH = "cash", _("Cash")
        RECHARGE = "recharge", _("Recharge")

    lottery_wheel = models.ForeignKey(
        LotteryWheel,
        on_delete=models.CASCADE,
        related_name="lottery_wheel_prizes",
    )
    name = models.CharField(verbose_name=_("name"), max_length=100)

    prize_amount = models.DecimalField(
        verbose_name=_("Prize Amount"),
        max_digits=20,
        decimal_places=0,
    )
    probability = models.PositiveSmallIntegerField(
        verbose_name=_("probability"),
        validators=[
            MaxValueValidator(100),
        ],
    )
    prize_type = models.CharField(
        verbose_name=_("Prize Type"),
        max_length=10,
        choices=PrizeType.choices,
        default=PrizeType.CASH,
    )

    def __str__(self):
        return f"lottery: {self.lottery_wheel}, prize: {self.name}"
