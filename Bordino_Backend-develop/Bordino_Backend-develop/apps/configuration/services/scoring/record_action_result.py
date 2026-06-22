from dataclasses import dataclass

from apps.wallet.models.transactions.activity import ActivityTransaction


@dataclass
class RecordActionResult:
    activity_transaction: ActivityTransaction
    already_exists: bool
    message: str
