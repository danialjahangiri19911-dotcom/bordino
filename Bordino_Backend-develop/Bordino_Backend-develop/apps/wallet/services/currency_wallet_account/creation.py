from dataclasses import dataclass

from django.db import transaction

from apps.wallet.models import Currency, CurrencyPresetWallet, CurrencyWalletAccount, Wallet
from apps.wallet.repositories.currency_wallet_account.command import (
    CurrencyWalletAccountCommandRepository,
)
from apps.wallet.repositories.currency_wallet_account.query import (
    CurrencyWalletAccountQueryRepository,
)


class CurrencyWalletAccountCreationService:
    def __init__(self):
        self.currency_wallet_account_command_repository = CurrencyWalletAccountCommandRepository()
        self.currency_wallet_account_query_repository = CurrencyWalletAccountQueryRepository()

    @dataclass
    class CreateCurrencyWalletAccountDTO:
        wallet: Wallet
        name: str
        symbol: str
        primary: bool

    def create_currency_wallet_account_by_system(self, dto: CreateCurrencyWalletAccountDTO):
        with transaction.atomic():
            if dto.primary:
                CurrencyWalletAccount.objects.filter(wallet=dto.wallet, primary=True).update(
                    primary=False
                )

            currency, _ = Currency.objects.get_or_create(
                symbol=dto.symbol, defaults={"name": dto.name}
            )

            preset_wallet, _ = CurrencyPresetWallet.objects.get_or_create(
                activation_by=CurrencyPresetWallet.ActivationBy.SYSTEM,
                wallet_type=CurrencyPresetWallet.WalletType.CUSTOMER,
                currency=currency,
                defaults={
                    "name": "کیف پول تومانی",
                    "actions": [
                        CurrencyPresetWallet.Action.DEPOSIT,
                        CurrencyPresetWallet.Action.WITHDRAW,
                        CurrencyPresetWallet.Action.PURCHASE,
                        CurrencyPresetWallet.Action.TRANSFER_IN,
                        CurrencyPresetWallet.Action.TRANSFER_OUT,
                        CurrencyPresetWallet.Action.RECEIVE_FROM_EXCHANGE,
                    ],
                },
            )

            currency_wallet_account_model = CurrencyWalletAccount(
                name=dto.name,
                preset_wallet=preset_wallet,
                wallet=dto.wallet,
                primary=dto.primary,
            )
            currency_wallet_account = self.currency_wallet_account_command_repository.create(
                currency_wallet_account_model
            )
        return currency_wallet_account
