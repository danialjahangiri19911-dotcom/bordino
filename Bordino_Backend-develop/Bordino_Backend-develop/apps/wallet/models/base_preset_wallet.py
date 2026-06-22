from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.django_helper.models.base import AbstractBaseModel


class BasePresetWallet(AbstractBaseModel):
    class Meta(AbstractBaseModel.Meta):
        abstract = True

        constraints = [
            models.UniqueConstraint(
                fields=["wallet_type", "default"],
                condition=models.Q(default=True),
                name="%(app_label)s_%(class)s_unique_default_per_wallet_type",
            )
        ]

    class WalletType(models.TextChoices):
        SPONSOR = "sponsor", _("Sponsor")
        CUSTOMER = "customer", _("Customer")
        SYSTEM = "system", _("System")

    class ActivationBy(models.TextChoices):
        USER = "user", _("User")
        SYSTEM = "system", _("System")

    class Status(models.TextChoices):
        VALID = "valid", _("Valid")
        SUSPEND = "suspend", _("Suspend")
        INVALID = "invalid", _("Invalid")

    name = models.CharField(verbose_name=_("Name"), max_length=50, unique=True)
    wallet_type = models.CharField(
        verbose_name=_("Wallet Type"), max_length=10, choices=WalletType.choices
    )
    status = models.CharField(
        verbose_name=_("Status"),
        max_length=20,
        choices=Status.choices,
        default=Status.VALID,
    )
    activation_by = models.CharField(
        verbose_name=_("Activatoin By"),
        max_length=10,
        choices=ActivationBy.choices,
        default=ActivationBy.USER,
    )
    default = models.BooleanField(verbose_name=_("default"), default=False)
