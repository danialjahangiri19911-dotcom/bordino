from django.db import models

from apps.configuration.enums import Section
from apps.wallet.models.transactions.base import BaseTransaction


class ActivityTransaction(BaseTransaction):
    customer = models.ForeignKey(
        "users.Customer", on_delete=models.PROTECT, related_name="activity_transactions"
    )

    section = models.CharField(
        max_length=50,
        db_index=True,
    )

    action_type = models.CharField(
        max_length=100,
        db_index=True,
    )

    score_value = models.IntegerField(null=True, blank=True)

    reward_data = models.JSONField(default=dict, blank=True)

    metadata = models.JSONField(default=dict, blank=True)

    def __str__(self):
        return f"{self.section}/{self.action_type}: {self.customer}"
