from dataclasses import dataclass
from decimal import Decimal

from django.db import transaction
from rest_framework.exceptions import ValidationError

from apps.users.models import Customer
from apps.wallet.models.currency_wallet_account import CurrencyWalletAccount
from apps.wallet.services.utils import is_wallet_expired


class CurrencyWalletAccountTransferService:
    @dataclass
    class SendPrizeToCustomerDTO:
        prize_amount: Decimal
        customer: Customer
        destination_wallet_account: CurrencyWalletAccount

    @transaction.atomic
    def send_prize_to_customer(self, dto: SendPrizeToCustomerDTO):
        wallet = dto.destination_wallet_account.wallet
        if is_wallet_expired(wallet):
            raise ValidationError("Wallet has expired")

        dto.destination_wallet_account.balance += dto.prize_amount
        dto.destination_wallet_account.save()
