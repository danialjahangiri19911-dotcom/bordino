import logging

from django.db import transaction

from apps.wallet.models import TokenWalletAccount


class TokenWalletAccountCommandRepository:
    @staticmethod
    def create(wallet_account: TokenWalletAccount):
        try:
            with transaction.atomic():
                wallet_account.full_clean()
                wallet_account.save()
            return wallet_account
        except Exception as e:
            logging.error("Error while creating token wallet account: %s", e)
            raise e
