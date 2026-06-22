from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.django_helper.models.base import AbstractBaseModel
from apps.django_helper.utils.validators.uppercase import uppercase_validator


class Currency(AbstractBaseModel):
    class Meta(AbstractBaseModel.Meta):
        verbose_name = _("Currency")
        verbose_name_plural = _("Currencies")

    symbol = models.CharField(
        verbose_name=_("Symbol"),
        max_length=10,
        validators=[uppercase_validator],
        unique=True,
    )
    name = models.CharField(verbose_name=_("Name"), max_length=100)

    def __str__(self):
        return self.name
