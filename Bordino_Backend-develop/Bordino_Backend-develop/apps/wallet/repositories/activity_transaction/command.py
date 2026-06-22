import logging

from django.db import transaction

from apps.wallet.models.transactions.activity import ActivityTransaction


class ActivityTransactionCommandRepository:
    @staticmethod
    def create(activity_transaction: ActivityTransaction) -> ActivityTransaction:
        with transaction.atomic():
            activity_transaction.full_clean()
            activity_transaction.save()
        return activity_transaction

    @staticmethod
    def update(activity_transaction: ActivityTransaction) -> ActivityTransaction:
        try:
            with transaction.atomic():
                activity_transaction.full_clean()
                activity_transaction.save()
            return activity_transaction
        except Exception as e:
            logging.error("Error while updating activity transaction: %s", e)
            raise e
