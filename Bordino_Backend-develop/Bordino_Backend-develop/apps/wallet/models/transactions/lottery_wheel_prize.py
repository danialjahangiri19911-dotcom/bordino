from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.wallet.models.transactions.base import BaseTransaction


class LotteryWheelPrizeTransaction(BaseTransaction):
    class Meta(BaseTransaction.Meta):
        verbose_name = _("Lottery Wheel Prize Transaction")
        verbose_name_plural = _("Lottery Wheel Prize Transactions")

    lottery_wheel = models.ForeignKey(
        "lottery.LotteryWheel",
        on_delete=models.PROTECT,
        related_name="prize_transactions",
        verbose_name=_("Lottery Wheel"),
    )

    prize = models.ForeignKey(
        "lottery.LotteryWheelPrize",
        on_delete=models.PROTECT,
        related_name="prize_transactions",
        verbose_name=_("Prize"),
    )

    customer = models.ForeignKey(
        "users.Customer",
        on_delete=models.PROTECT,
        related_name="prize_transactions",
        verbose_name=_("Customer"),
    )

    def __str__(self):
        return (
            f"Prize Payment: {self.prize.prize_type} {self.prize.prize_amount} for {self.customer}"
        )
