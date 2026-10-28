from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.django_helper.models.base import AbstractBaseModel
from apps.lottery.models import LotteryWheel, LotteryWheelPrize
from apps.users.models import Customer


class LotteryWheelSpinLog(AbstractBaseModel):
    """لاگِ هر چرخشِ گردونه: ضریبِ انتخابی، چرخ، جایزه و زمانِ چرخش (create_time)."""

    class Meta(AbstractBaseModel.Meta):
        verbose_name = _("Lottery Wheel Spin Log")
        verbose_name_plural = _("Lottery Wheel Spin Logs")
        indexes = [
            models.Index(fields=["lottery_wheel", "customer"]),
            models.Index(fields=["create_time"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=("customer", "request_id"),
                condition=models.Q(request_id__isnull=False),
                name="wheel_spin_unique_request_id",
            )
        ]

    lottery_wheel = models.ForeignKey(
        LotteryWheel,
        on_delete=models.CASCADE,
        related_name="spin_logs",
        verbose_name=_("Lottery Wheel"),
    )
    customer = models.ForeignKey(
        Customer,
        on_delete=models.CASCADE,
        related_name="lottery_wheel_spin_logs",
        verbose_name=_("Customer"),
    )
    # The app's id for this spin (a retried request returns this spin instead of spinning again).
    request_id = models.CharField(max_length=64, null=True, blank=True, editable=False)
    # Points paid for this spin (the wheel's cost at the time).
    cost = models.PositiveIntegerField(verbose_name=_("Cost"), default=0)
    multiplier = models.PositiveSmallIntegerField(
        verbose_name=_("Multiplier"),
        default=1,
        help_text=_("ضریبِ انتخابیِ کاربر هنگامِ چرخش (۱ تا ۵)"),
    )
    prize = models.ForeignKey(
        LotteryWheelPrize,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="spin_logs",
        verbose_name=_("Prize"),
    )

    def __str__(self):
        return f"{self.customer} - {self.lottery_wheel} - x{self.multiplier} - {self.create_time}"
