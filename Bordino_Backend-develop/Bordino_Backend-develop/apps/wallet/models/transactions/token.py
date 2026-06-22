from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.wallet.models import Token, TokenWalletAccount
from apps.wallet.models.transactions.base import BaseTransaction


class TokenTransaction(BaseTransaction):
    class Meta(BaseTransaction.Meta):
        verbose_name = _("Token Transaction")
        verbose_name_plural = _("Token Transactions")

    source_wallet = models.ForeignKey(
        TokenWalletAccount,
        on_delete=models.PROTECT,
        related_name="%(class)s_outgoing",
        verbose_name=_("Source Wallet"),
    )

    destination_wallet = models.ForeignKey(
        TokenWalletAccount,
        on_delete=models.PROTECT,
        related_name="%(class)s_incoming",
        verbose_name=_("Destination Wallet"),
    )

    token = models.ForeignKey(
        Token,
        on_delete=models.PROTECT,
        related_name="transactions",
        verbose_name=_("Token"),
    )

    amount = models.DecimalField(
        verbose_name=_("Amount"),
        max_digits=20,
        decimal_places=0,
    )

    def __str__(self):
        return f"{self.amount} {self.token.symbol}"
