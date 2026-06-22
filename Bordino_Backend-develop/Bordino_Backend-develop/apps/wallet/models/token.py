from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.django_helper.models.base import AbstractBaseModel
from apps.django_helper.utils.validators.uppercase import uppercase_validator
from apps.users.models.file import File
from apps.users.models.sponsor import Sponsor


class Token(AbstractBaseModel):
    class Meta(AbstractBaseModel.Meta):
        verbose_name = _("Token")
        verbose_name_plural = _("Tokens")

    symbol = models.CharField(
        verbose_name=_("Symbol"),
        max_length=10,
        validators=[uppercase_validator],
        unique=True,
        db_index=True,
    )

    name = models.CharField(verbose_name=_("Name"), max_length=100, db_index=True)
    logo = models.ForeignKey(
        File,
        on_delete=models.CASCADE,
        verbose_name=_("logo"),
        related_name="tokens_logo",
        null=True,
        blank=True,
    )
    owner = models.ForeignKey(
        Sponsor,
        verbose_name=_("Owner"),
        on_delete=models.CASCADE,
        related_name="tokens_owner",
        null=True,
        blank=True,
    )
    price = models.DecimalField(
        verbose_name=_("Price"),
        max_digits=20,
        decimal_places=0,
    )

    def __str__(self):
        return self.symbol
