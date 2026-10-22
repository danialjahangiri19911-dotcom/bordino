"""Every change to a points or currency balance goes through here.

A balance is never read into Python, changed and saved back: two requests doing that at once
overwrite each other (a purchase restores points another one spent, a credit vanishes). Changes
are one `UPDATE ... SET amount = amount + delta`. A debit that must not overdraw first locks the
account row (inside the caller's transaction), checks it, then updates it, so two debits cannot
both pass the check against the same balance.
"""

from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db.models import F
from django.utils.translation import gettext_lazy as _

from apps.wallet.models import CurrencyWalletAccount, TokenWalletAccount
from apps.wallet.models.base_wallet_account import BaseWalletAccount
from apps.wallet.repositories.wallet.query import WalletQueryRepository
from apps.wallet.services.utils import get_max_negative_limit, would_deduction_exceed_negative_limit

# The points token. A wallet may hold other tokens; points are only ever this one.
POINTS_SYMBOL = "L"


def customer_wallet(user):
    """The user's customer wallet (users have one; `user.wallets` is the reverse relation)."""
    return WalletQueryRepository.customer_wallet(user).first()


def _customer_wallet_ids(user):
    # A plain id list: the wallet query carries an aggregate, which does not belong in the
    # FOR UPDATE query below.
    return list(WalletQueryRepository.customer_wallet(user).values_list("pk", flat=True))


def points_account(user, lock=False):
    """The user's points account, picked by the server (never an id from the client). With
    `lock`, the row is locked FOR UPDATE (call inside a transaction)."""
    accounts = TokenWalletAccount.objects.filter(
        wallet__in=_customer_wallet_ids(user),
        token__symbol=POINTS_SYMBOL,
    ).order_by("create_time")
    if lock:
        # of=self: lock the account only, not the shared Token row it joins.
        accounts = accounts.select_for_update(of=("self",))
    return accounts.first()


def currency_account(user, lock=False):
    """The user's primary currency (rial) account."""
    accounts = CurrencyWalletAccount.objects.filter(
        wallet__in=_customer_wallet_ids(user), primary=True
    ).order_by("create_time")
    if lock:
        accounts = accounts.select_for_update(of=("self",))
    return accounts.first()


def lock(account):
    """`account` read again, locked FOR UPDATE (call inside a transaction)."""
    return type(account).objects.select_for_update(of=("self",)).get(pk=account.pk)


def add_points(account, delta):
    TokenWalletAccount.objects.filter(pk=account.pk).update(amount=F("amount") + int(delta))


def add_currency(account, delta):
    CurrencyWalletAccount.objects.filter(pk=account.pk).update(
        balance=F("balance") + Decimal(delta)
    )


def check_debit(locked_account, amount, insufficient_message):
    """Raise unless `locked_account` (from `lock` / `points_account(lock=True)`) may pay `amount`:
    it must be active and stay within the configured negative limit."""
    if locked_account.status != BaseWalletAccount.WalletStatus.VALID:
        raise ValidationError(_("This wallet account is not active."))
    current = (
        locked_account.amount
        if isinstance(locked_account, TokenWalletAccount)
        else locked_account.balance
    )
    if would_deduction_exceed_negative_limit(
        current, amount, get_max_negative_limit(locked_account)
    ):
        raise ValidationError(insufficient_message)
