from django.core.exceptions import ValidationError
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.wallet.models.base_wallet_account import BaseWalletAccount
from apps.wallet.models.currency_preset_wallet import CurrencyPresetWallet
from apps.wallet.models.wallet import Wallet


class CurrencyWalletAccount(BaseWalletAccount):
    class Meta(BaseWalletAccount.Meta):
        unique_together = ("wallet", "preset_wallet")
        verbose_name = _("Currency Wallet Account")
        verbose_name_plural = _("Currency Wallet Accounts")

        constraints = [
            models.UniqueConstraint(
                fields=["wallet", "primary"],
                name="only_one_primary_record",
                condition=models.Q(primary=True),
            )
        ]

    preset_wallet = models.ForeignKey(
        CurrencyPresetWallet,
        on_delete=models.CASCADE,
        verbose_name=_("Preset Wallet"),
        related_name="currency_wallet_accounts_preset_wallet",
    )
    wallet = models.ForeignKey(
        Wallet,
        on_delete=models.CASCADE,
        verbose_name=_("Wallet"),
        related_name="currency_wallet_accounts",
    )
    balance = models.DecimalField(
        verbose_name=_("Balance"), max_digits=20, decimal_places=0, default=0
    )
    primary = models.BooleanField(verbose_name=_("Primary"), default=False)

    def clean(self):
        super().clean()
        from apps.wallet.services.utils import get_max_negative_limit

        max_negative = get_max_negative_limit(self)
        balance_int = int(self.balance)
        if balance_int < -max_negative:
            raise ValidationError(
                {
                    "balance": _(
                        "Currency balance cannot go below %(limit)s. Current value: %(balance)s."
                    )
                    % {"limit": -max_negative, "balance": self.balance}
                }
            )

    def __str__(self):
        currency_symbol = self.preset_wallet.currency.symbol if self.preset_wallet.currency else ""
        return f"{self.wallet.owner.username} - {self.preset_wallet.name} ({currency_symbol}) - {self.balance}"
