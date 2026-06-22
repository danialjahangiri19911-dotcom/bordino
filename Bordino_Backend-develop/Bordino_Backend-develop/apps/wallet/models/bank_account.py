from django.contrib.auth import get_user_model
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.django_helper.models.base import AbstractBaseModel

User = get_user_model()


class BankAccount(AbstractBaseModel):
    class Status(models.TextChoices):
        PENDING = "pending", _("Pending")
        APPROVED = "approved", _("Approved")
        REJECTED = "rejected", _("Rejected")

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="bank_accounts")
    iban = models.CharField(max_length=26)
    bank = models.ForeignKey("wallet.Bank", on_delete=models.PROTECT, related_name="bank_accounts")
    account_holder = models.CharField(max_length=200)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    is_deleted = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.bank.name} - {self.iban}"
