from django.contrib.auth import get_user_model
from django.db import transaction

from apps.users.models import Customer
from apps.wallet.models import Token, TokenPresetWallet, TokenWalletAccount
from apps.wallet.models.base_wallet_account import BaseWalletAccount

User = get_user_model()


class TokenWalletAccountQueryRepository:
    @staticmethod
    def all():
        return TokenWalletAccount.objects.all()

    @classmethod
    def filter_by_wallet_type(cls, preset_wallet_type):
        return cls.all().filter(preset_wallet__wallet_type=preset_wallet_type)

    @classmethod
    def filter_by_customer(cls, customer):
        return cls.all().filter(customer=customer)

    @classmethod
    def filter_by_customer_and_token(cls, customer, token):
        return cls.all().filter(
            wallet__owner=customer.user,
            token=token,
            preset_wallet__wallet_type=TokenPresetWallet.WalletType.CUSTOMER,
        )

    @classmethod
    def get_by_id_for_user(cls, user: User, account_id) -> TokenWalletAccount | None:
        return (
            cls.all()
            .filter(id=account_id, wallet__owner=user)
            .select_related("token", "wallet", "preset_wallet")
            .first()
        )

    @classmethod
    def get_last_active_for_user(cls, user: User) -> TokenWalletAccount | None:
        return (
            cls.all()
            .filter(
                wallet__owner=user,
                status=BaseWalletAccount.WalletStatus.VALID,
                preset_wallet__wallet_type=TokenPresetWallet.WalletType.CUSTOMER,
            )
            .select_related("token", "wallet", "preset_wallet")
            .order_by("-create_time")
            .first()
        )

    @classmethod
    def get_last_active_for_customer(cls, customer: Customer) -> TokenWalletAccount | None:
        wallet_account = cls.get_last_active_for_user(customer.user)

        if wallet_account:
            return wallet_account

        with transaction.atomic():
            customer_wallet = customer.user.wallets.filter(
                wallet_type__in=["customer", "mixed"]
            ).first()

            if not customer_wallet:
                from apps.wallet.services.wallet.creation import WalletCreationService

                wallet_service = WalletCreationService()
                customer_wallet = wallet_service.create_wallet(
                    wallet_service.CreateWalletDTO(user=customer.user)
                )

            token = Token.objects.filter(symbol="L").first()
            if not token:
                return None

            from apps.wallet.services.token_wallet_account.creation import (
                TokenWalletAccountCreationService,
            )

            creation_service = TokenWalletAccountCreationService()
            wallet_account = creation_service.create_token_wallet_account_by_system(
                creation_service.CreateTokenWalletAccountDTO(
                    wallet=customer_wallet,
                    name=f"کیف پول {token.symbol}",
                    symbol=token.symbol,
                )
            )

        return wallet_account
