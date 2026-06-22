from django.contrib.postgres.fields import ArrayField
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.wallet.models.base_preset_wallet import BasePresetWallet
from apps.wallet.models.currency import Currency


class CurrencyPresetWallet(BasePresetWallet):
    class Meta(BasePresetWallet.Meta):
        verbose_name = _("Currency Preset Wallet")
        verbose_name_plural = _("Currency Preset Wallets")

        constraints = [
            models.UniqueConstraint(
                fields=["wallet_type", "activation_by", "currency"],
                name="unique_currency_preset_wallet",
            )
        ]

    class Action(models.TextChoices):
        DEPOSIT = "Deposit", _("Deposit")
        WITHDRAW = "withdraw", _("Withdraw")
        PURCHASE = "purchase", _("Purchase")
        TRANSFER_IN = "transfer_in", _("Transfer In")
        TRANSFER_OUT = "transfer_out", _("Transfer Out")
        RECEIVE_FROM_EXCHANGE = "receive_from_exchange", _("Receive From Exchange")

    currency = models.ForeignKey(
        Currency,
        on_delete=models.PROTECT,
        verbose_name=_("Currency"),
        related_name="currency_preset_wallets_currency",
    )
    actions = ArrayField(
        models.CharField(
            choices=Action.choices,
            max_length=30,
        ),
        verbose_name=_("actions"),
        default=list,
    )

    def __str__(self):
        return self.name
