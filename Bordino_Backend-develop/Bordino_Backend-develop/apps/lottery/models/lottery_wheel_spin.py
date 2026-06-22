from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.django_helper.models.base import AbstractBaseModel
from apps.lottery.models import LotteryWheel
from apps.users.models import Customer


class LotteryWheelSpin(AbstractBaseModel):
    class Meta(AbstractBaseModel.Meta):
        verbose_name = _("Lottery Wheel Spin")
        verbose_name_plural = _("Lottery Wheel Spins")
        indexes = [
            models.Index(fields=["lottery_wheel", "customer"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["lottery_wheel", "customer", "create_time"],
                name="unique_lottery_wheel_customer_spin_time",
            )
        ]

    lottery_wheel = models.ForeignKey(
        LotteryWheel,
        on_delete=models.CASCADE,
        related_name="spins",
        verbose_name=_("Lottery Wheel"),
    )
    customer = models.ForeignKey(
        Customer,
        on_delete=models.CASCADE,
        related_name="lottery_wheel_spins",
        verbose_name=_("Customer"),
    )
    count = models.PositiveIntegerField(
        verbose_name=_("Count"),
        default=1,
    )

    def __str__(self):
        return f"{self.customer} - {self.lottery_wheel} - {self.count}"
