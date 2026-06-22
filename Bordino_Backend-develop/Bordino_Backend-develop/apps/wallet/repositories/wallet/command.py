import logging

from django.db import transaction

from apps.wallet.models import Wallet


class WalletCommandRepository:
    @staticmethod
    def create(wallet: Wallet):
        with transaction.atomic():
            wallet.full_clean()
            wallet.save()
        return wallet

    @staticmethod
    def update(wallet: Wallet):
        try:
            with transaction.atomic():
                wallet.full_clean()
                wallet.save()
            return wallet
        except Exception as e:  # pylint: disable=broad-except
            logging.error("Error while updating wallet: %s", e)
            raise e
