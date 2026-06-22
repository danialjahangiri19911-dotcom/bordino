from django.core.exceptions import ValidationError
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.wallet.models.base_wallet_account import BaseWalletAccount
from apps.wallet.models.token import Token
from apps.wallet.models.token_preset_wallet import TokenPresetWallet
from apps.wallet.models.wallet import Wallet


class TokenWalletAccount(BaseWalletAccount):
    class Meta(BaseWalletAccount.Meta):
        unique_together = ("wallet", "preset_wallet", "token")
        verbose_name = _("Token Wallet Account")
        verbose_name_plural = _("Token Wallet Accounts")

    preset_wallet = models.ForeignKey(
        TokenPresetWallet,
        on_delete=models.CASCADE,
        verbose_name=_("Preset Wallet"),
        related_name="token_wallet_accounts_preset_wallet",
    )
    wallet = models.ForeignKey(
        Wallet,
        on_delete=models.CASCADE,
        verbose_name=_("Wallet"),
        related_name="token_wallet_accounts",
    )
    token = models.ForeignKey(
        Token,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        verbose_name=_("Token"),
        related_name="token_wallet_accounts_token",
    )
    amount = models.IntegerField(verbose_name=_("Amount"), default=0)

    def clean(self):
        super().clean()
        from apps.wallet.services.utils import get_max_negative_limit

        max_negative = get_max_negative_limit(self)
        if self.amount < -max_negative:
            raise ValidationError(
                {
                    "amount": _(
                        "Points balance cannot go below %(limit)s. Current value: %(amount)s."
                    )
                    % {"limit": -max_negative, "amount": self.amount}
                }
            )

    @property
    def balance(self):
        return self.amount * self.token.price

    def __str__(self):
        token_symbol = self.token.symbol if self.token else "N/A"
        return f"{self.wallet.owner.username} - {self.preset_wallet.name} - {token_symbol} ({self.amount})"
