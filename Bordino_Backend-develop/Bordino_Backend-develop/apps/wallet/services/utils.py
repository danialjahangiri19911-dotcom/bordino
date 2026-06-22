from datetime import timedelta
from decimal import Decimal

from django.utils import timezone

from apps.configuration.models import SystemConfiguration
from apps.wallet.models import CurrencyWalletAccount, TokenWalletAccount, Wallet


def _wallet_currency_expiration_days() -> int:
    return SystemConfiguration.objects.get("WALLET_CURRENCY_EXPIRATION_DAYS", 365)


def is_wallet_expired(wallet: Wallet) -> bool:
    expire_date = wallet.create_time + timedelta(days=_wallet_currency_expiration_days())
    return timezone.now() > expire_date


def get_max_negative_limit(
    account_or_type: TokenWalletAccount | CurrencyWalletAccount | str,
) -> int:
    if isinstance(account_or_type, TokenWalletAccount):
        return SystemConfiguration.objects.get("WALLET_MAX_NEGATIVE_POINTS", 0)
    if isinstance(account_or_type, CurrencyWalletAccount):
        return SystemConfiguration.objects.get("WALLET_MAX_NEGATIVE_CURRENCY", 0)
    if account_or_type == "points":
        return SystemConfiguration.objects.get("WALLET_MAX_NEGATIVE_POINTS", 0)
    if account_or_type == "currency":
        return SystemConfiguration.objects.get("WALLET_MAX_NEGATIVE_CURRENCY", 0)
    raise ValueError(
        "account_or_type must be TokenWalletAccount, CurrencyWalletAccount, 'points', or 'currency'"
    )


def would_deduction_exceed_negative_limit(
    current_balance: int | Decimal | float,
    deduction_amount: int | Decimal | float,
    max_negative_limit: int,
) -> bool:
    current = Decimal(current_balance)
    deduction = Decimal(deduction_amount)
    limit = Decimal(max_negative_limit)
    return (current - deduction) < -limit


def is_out_of_score(token_wallet_account: TokenWalletAccount | None) -> bool:
    if token_wallet_account is None:
        return True
    return int(token_wallet_account.amount) < -get_max_negative_limit(token_wallet_account)


def is_out_of_currency_balance(
    currency_wallet_account: CurrencyWalletAccount | None,
) -> bool:
    if currency_wallet_account is None:
        return True
    balance = currency_wallet_account.balance
    return (int(balance) if isinstance(balance, Decimal) else balance) < -get_max_negative_limit(
        currency_wallet_account
    )
