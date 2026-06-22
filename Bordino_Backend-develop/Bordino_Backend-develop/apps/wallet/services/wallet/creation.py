from dataclasses import dataclass

from apps.django_helper.utils.update_instance import updated_instance
from apps.users.models.user import User
from apps.wallet.models import Wallet
from apps.wallet.repositories.wallet.command import WalletCommandRepository
from apps.wallet.repositories.wallet.query import WalletQueryRepository


class WalletCreationService:
    def __init__(self):
        self.wallet_command_repository = WalletCommandRepository()
        self.wallet_query_repository = WalletQueryRepository()

    @dataclass
    class CreateWalletDTO:
        user: User

    def create_wallet(self, dto: CreateWalletDTO):
        user = dto.user
        wallet_type = (
            Wallet.WalletType.MIXED
            if user.is_customer and user.is_sponsor
            else Wallet.WalletType.CUSTOMER
            if user.is_customer
            else Wallet.WalletType.SPONSOR
        )

        wallet_model = Wallet(owner=dto.user, wallet_type=wallet_type)
        wallet = self.wallet_command_repository.create(wallet_model)
        return wallet

    def _update_wallet_type(self, wallet: Wallet, wallet_type):
        if wallet.wallet_type != wallet_type:
            updated_wallet = updated_instance(instance=wallet, wallet_type=wallet_type)
            wallet = self.wallet_command_repository.update(updated_wallet)
        return wallet
