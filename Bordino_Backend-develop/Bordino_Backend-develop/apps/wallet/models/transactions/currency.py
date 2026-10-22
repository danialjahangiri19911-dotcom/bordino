from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q
from django.utils.translation import gettext_lazy as _

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
    # The app's id for one withdrawal: a retried request with the same id is the same withdrawal.
    request_id = models.CharField(max_length=64, null=True, blank=True, editable=False)

    FINAL = ("completed", "failed", "cancelled")

    class Meta(BaseTransaction.Meta):
        constraints = [
            models.UniqueConstraint(
                fields=("source_wallet", "request_id"),
                condition=Q(request_id__isnull=False),
                name="currency_tx_unique_request_id",
            )
        ]

    def clean(self):
        super().clean()
        # A finished withdrawal stays finished: its money was paid out or given back already,
        # and changing it again would move the balance a second time.
        if self.pk:
            stored = (
                CurrencyTransaction.objects.filter(pk=self.pk)
                .values("status", "amount", "source_wallet_id", "bank_account_id")
                .first()
            )
            if stored and stored["status"] in self.FINAL and stored["status"] != self.status:
                raise ValidationError(
                    {"status": _("A finished transaction cannot change its status.")}
                )
            # What was reserved cannot be edited afterwards (a refund gives back the original).
            if stored and (
                stored["amount"] != self.amount
                or stored["source_wallet_id"] != self.source_wallet_id
                or stored["bank_account_id"] != self.bank_account_id
            ):
                raise ValidationError(
                    _("Amount, account and bank account of a transaction cannot be changed.")
                )

    def __str__(self):
        return f"{self.amount} {self.currency.symbol}"
