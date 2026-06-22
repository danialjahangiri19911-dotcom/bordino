from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.users.models import Customer
from apps.wallet.models import Token
from apps.wallet.models.transactions.base import BaseTransaction


class ReferralRewardTransaction(BaseTransaction):
    class Meta(BaseTransaction.Meta):
        verbose_name = _("Referral Reward Transaction")
        verbose_name_plural = _("Referral Reward Transactions")

    referrer = models.ForeignKey(
        Customer,
        on_delete=models.CASCADE,
        related_name="referral_rewards_earned",
        verbose_name=_("Referrer"),
    )
    buyer = models.ForeignKey(
        Customer,
        on_delete=models.CASCADE,
        related_name="referral_rewards_generated",
        verbose_name=_("Ticket Buyer"),
    )
    token = models.ForeignKey(Token, on_delete=models.CASCADE, verbose_name=_("Token"))
    tokens_amount = models.PositiveIntegerField(verbose_name=_("Reward Tokens Amount"))
    level = models.PositiveSmallIntegerField(verbose_name=_("Referral Level"))

    def __str__(self):
        return f"{self.tokens_amount} tokens for {self.referrer} from {self.buyer}'s purchase"
