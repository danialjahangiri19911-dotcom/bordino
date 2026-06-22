from dataclasses import dataclass

from django.db import transaction

from apps.wallet.models import Token, TokenPresetWallet, TokenWalletAccount, Wallet
from apps.wallet.repositories.token_wallet_account.command import (
    TokenWalletAccountCommandRepository,
)
from apps.wallet.repositories.token_wallet_account.query import TokenWalletAccountQueryRepository


class TokenWalletAccountCreationService:
    def __init__(self):
        self.token_wallet_account_command_repository = TokenWalletAccountCommandRepository()
        self.token_wallet_account_query_repository = TokenWalletAccountQueryRepository()

    @dataclass
    class CreateTokenWalletAccountDTO:
        wallet: Wallet
        name: str
        symbol: str

    def create_token_wallet_account_by_system(self, dto: CreateTokenWalletAccountDTO):
        with transaction.atomic():
            token, _ = Token.objects.get_or_create(
                symbol=dto.symbol, defaults={"name": dto.name, "price": 0}
            )

            preset_wallet, _ = TokenPresetWallet.objects.get_or_create(
                activation_by=TokenPresetWallet.ActivationBy.SYSTEM,
                wallet_type=TokenPresetWallet.WalletType.CUSTOMER,
                defaults={
                    "name": dto.name,
                    "actions": [
                        TokenPresetWallet.Action.EXCHANGE,
                        TokenPresetWallet.Action.TRANSFER_IN,
                        TokenPresetWallet.Action.TRANSFER_OUT,
                    ],
                },
            )

            token_wallet_account_model = TokenWalletAccount(
                name=dto.name,
                preset_wallet=preset_wallet,
                wallet=dto.wallet,
                token=token,
            )
            token_wallet_account = self.token_wallet_account_command_repository.create(
                token_wallet_account_model
            )
        return token_wallet_account
