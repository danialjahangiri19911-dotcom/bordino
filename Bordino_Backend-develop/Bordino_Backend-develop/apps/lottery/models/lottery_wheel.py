from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.django_helper.models.base import AbstractBaseModel
from apps.users.models import Sponsor
from apps.wallet.models import Token


class LotteryWheel(AbstractBaseModel):
    class Meta(AbstractBaseModel.Meta):
        verbose_name = _("Lottery Wheel")
        verbose_name_plural = _("Lottery Wheels")

    class Status(models.TextChoices):
        ACTIVE = "active", _("Active")
        INACTIVE = "inactive", _("Inactive")

    name = models.CharField(verbose_name=_("name"), max_length=20)
    owner = models.ForeignKey(Sponsor, verbose_name=_("Owner"), on_delete=models.CASCADE)
    tokens_whitelist = models.ManyToManyField(
        Token,
        verbose_name=_("Tokens Whitelist"),
        related_name="lottery_wheels",
    )
    cost_per_spin = models.DecimalField(
        verbose_name=_("Cost Per Spin"), max_digits=20, decimal_places=0, default=0
    )
    max_spins = models.PositiveIntegerField(
        verbose_name=_("Max Spins"),
        default=10,
    )
    max_spins_per_customer = models.PositiveIntegerField(
        verbose_name=_("Max Spins Per Customer"),
        default=10,
    )
    status = models.CharField(
        verbose_name=_("Status"),
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
    )

    def __str__(self):
        return self.name
