from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.wallet.models.transactions.base import BaseTransaction


class LotteryPrizeTransaction(BaseTransaction):
    class Meta(BaseTransaction.Meta):
        verbose_name = _("Lottery Prize Transaction")
        verbose_name_plural = _("Lottery Prize Transactions")

    lottery = models.ForeignKey(
        "lottery.Lottery",
        on_delete=models.PROTECT,
        related_name="prize_transactions",
        verbose_name=_("Lottery"),
    )

    ticket = models.OneToOneField(
        "lottery.Ticket",
        on_delete=models.PROTECT,
        related_name="prize_transaction",
        verbose_name=_("Winning Ticket"),
    )

    prize_amount = models.DecimalField(
        verbose_name=_("Prize Amount"),
        max_digits=20,
        decimal_places=0,
        null=True,
        blank=True,
    )

    def __str__(self):
        return f"Prize Payment: {self.prize_amount} for {self.ticket}"
