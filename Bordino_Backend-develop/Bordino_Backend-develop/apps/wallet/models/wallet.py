from django.contrib.auth import get_user_model
from django.db import models
from django.db.models import DecimalField, F, Sum, Value
from django.utils.translation import gettext_lazy as _

from apps.django_helper.models.base import AbstractBaseModel

User = get_user_model()


class Wallet(AbstractBaseModel):
    class Meta(AbstractBaseModel.Meta):
        verbose_name = _("Wallet")
        verbose_name_plural = _("Wallets")

    class WalletType(models.TextChoices):
        SPONSOR = "sponsor", _("Sponsor")
        CUSTOMER = "customer", _("Customer")
        MIXED = "mixed", _("Mixed")

    owner = models.ForeignKey(
        User, verbose_name=_("Owner"), on_delete=models.CASCADE, related_name="wallets"
    )
    wallet_type = models.CharField(
        max_length=10, verbose_name=_("Wallet Type"), choices=WalletType.choices
    )

    @property
    def balance(self):
        """Calculate total balance from all connected wallet accounts"""
        # Get currency balance
        currency_balance = (
            self.currency_wallet_accounts.aggregate(
                total=Sum("balance", default=Value(0, output_field=DecimalField()))
            )["total"]
            or 0
        )

        # Get token balance (amount * price)
        token_balance = (
            self.token_wallet_accounts.aggregate(
                total=Sum(
                    F("amount") * F("token__price"),
                    default=Value(0, output_field=DecimalField()),
                )
            )["total"]
            or 0
        )

        return currency_balance + token_balance

    def __str__(self):
        return f"{self.owner}-{self.wallet_type}"
