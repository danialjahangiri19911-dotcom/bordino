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

    class Meta(BaseTransaction.Meta):
        constraints = [
            # Each action is rewarded once per customer (RecordActionService); the database
            # holds that even when several claims arrive at the same moment.
            models.UniqueConstraint(
                fields=("customer", "section", "action_type"), name="activity_once_per_customer"
            )
        ]

    def __str__(self):
        return f"{self.section}/{self.action_type}: {self.customer}"
