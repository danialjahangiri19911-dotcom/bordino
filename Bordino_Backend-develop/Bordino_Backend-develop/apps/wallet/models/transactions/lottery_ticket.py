from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.wallet.models import Token, TokenWalletAccount
from apps.wallet.models.transactions.base import BaseTransaction


class LotteryTicketTransaction(BaseTransaction):
    class Meta(BaseTransaction.Meta):
        verbose_name = _("Lottery Ticket Transaction")
        verbose_name_plural = _("Lottery Ticket Transactions")

    customer = models.ForeignKey(
        "users.Customer",
        on_delete=models.PROTECT,
        related_name="lottery_ticket_transactions",
        verbose_name=_("Customer"),
    )

    source_wallet = models.ForeignKey(
        TokenWalletAccount,
        on_delete=models.PROTECT,
        related_name="lottery_ticket_transactions",
        verbose_name=_("Source Wallet"),
    )

    lottery = models.ForeignKey(
        "lottery.Lottery",  # Use string reference
        on_delete=models.PROTECT,
        related_name="ticket_transactions",
        verbose_name=_("Lottery"),
    )

    ticket = models.OneToOneField(
        "lottery.Ticket",  # Use string reference
        on_delete=models.PROTECT,
        related_name="purchase_transaction",
        verbose_name=_("Ticket"),
    )

    token = models.ForeignKey(
        Token,
        on_delete=models.PROTECT,
        related_name="lottery_ticket_transactions",
        verbose_name=_("Token"),
    )

    amount = models.DecimalField(verbose_name=_("Amount"), max_digits=20, decimal_places=0)

    def __str__(self):
        return f"Ticket Purchase: {self.amount} {self.token.symbol} for {self.ticket}"
