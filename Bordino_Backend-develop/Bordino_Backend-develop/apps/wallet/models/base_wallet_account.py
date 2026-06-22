from django.core.exceptions import ValidationError
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.django_helper.models.base import AbstractBaseModel


class BaseWalletAccount(AbstractBaseModel):
    class Meta(AbstractBaseModel.Meta):
        abstract = True

    class WalletStatus(models.TextChoices):
        VALID = "valid", _("Valid")
        SUSPEND = "suspend", _("Suspend")
        BLOCKED = "blocked", _("Blocked")
        TERMINATED = "terminated", _("Terminated")

    name = models.CharField(
        max_length=50,
    )
    status = models.CharField(
        verbose_name=_("Status"),
        max_length=20,
        choices=WalletStatus.choices,
        default=WalletStatus.VALID,
    )

    def clean(self):
        super().clean()
        if self.wallet.wallet_type not in (
            self.preset_wallet.wallet_type,
            self.wallet.WalletType.MIXED,
        ):
            raise ValidationError(_("Wallet type does not match the preset wallet type."))
