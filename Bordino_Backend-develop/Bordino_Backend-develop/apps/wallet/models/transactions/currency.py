from django.db import models

from apps.wallet.models.currency import Currency
from apps.wallet.models.currency_wallet_account import CurrencyWalletAccount
from apps.wallet.models.transactions.base import BaseTransaction


class CurrencyTransaction(BaseTransaction):
    amount = models.DecimalField(max_digits=20, decimal_places=0)
    currency = models.ForeignKey(
        Currency,
        on_delete=models.PROTECT,
        related_name="transactions",
    )
    source_wallet = models.ForeignKey(
        CurrencyWalletAccount,
        on_delete=models.PROTECT,
        related_name="outgoing_transactions",
        null=True,
        blank=True,
    )
    destination_wallet = models.ForeignKey(
        CurrencyWalletAccount,
        on_delete=models.PROTECT,
        related_name="incoming_transactions",
        null=True,
        blank=True,
    )
    bank_account = models.ForeignKey(
        "wallet.BankAccount",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="transactions",
    )

    def __str__(self):
        return f"{self.amount} {self.currency.symbol}"
