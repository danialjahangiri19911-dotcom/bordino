from django.contrib.postgres.fields import ArrayField
from django.core.validators import MaxValueValidator
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.wallet.models.base_preset_wallet import BasePresetWallet


class TokenPresetWallet(BasePresetWallet):
    class Meta(BasePresetWallet.Meta):
        verbose_name = _("Token Preset Wallet")
        verbose_name_plural = _("Token Preset Wallets")

        constraints = [
            models.UniqueConstraint(
                fields=["wallet_type", "activation_by"],
                name="unique_token_preset_wallet",
            ),
        ]

    class Action(models.TextChoices):
        EXCHANGE = "exchange", _("Exchange")
        TRANSFER_IN = "transfer_in", _("Transfer In")
        TRANSFER_OUT = "transfer_out", _("Transfer Out")

    actions = ArrayField(
        models.CharField(choices=Action.choices, max_length=30, blank=True),
        default=list,
        verbose_name=_("actions"),
    )

    refund_percentage = models.PositiveSmallIntegerField(
        verbose_name=_("Refund Percentage"),
        validators=[
            MaxValueValidator(100),
        ],
        default=100,
    )

    def __str__(self):
        return self.name
