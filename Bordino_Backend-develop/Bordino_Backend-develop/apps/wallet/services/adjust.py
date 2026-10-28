"""Points changed by support (admin): one ledger entry per change, applied atomically."""

import uuid

from django.db import transaction
from django.db.models import F

from apps.wallet.models import ActivityTransaction, TokenWalletAccount
from apps.wallet.services import balance

SECTION = "admin_adjust"


@transaction.atomic
def adjust_points(account: TokenWalletAccount, delta: int, by=None) -> None:
    """Adds `delta` (negative takes away) to the balance as it is at this moment, never to a copy
    read earlier; the player's points account gets a history row (ActivityTransaction), any other
    token account an atomic update."""
    delta = int(delta)
    if not delta:
        return
    owner = account.wallet.owner
    customer = getattr(owner, "customer", None)
    points = balance.points_account(owner) if customer else None
    if points is not None and points.pk == account.pk:
        # The post_save signal adds score_value to the points account (F() update).
        ActivityTransaction.objects.create(
            customer=customer,
            section=SECTION,
            action_type=f"admin:{uuid.uuid4()}",
            score_value=delta,
            reward_data={"score": delta},
            metadata={"by": str(getattr(by, "pk", "") or "")},
            status=ActivityTransaction.Status.COMPLETED,
            description=f"Support adjustment {delta:+d}",
        )
    else:
        TokenWalletAccount.objects.filter(pk=account.pk).update(amount=F("amount") + delta)
