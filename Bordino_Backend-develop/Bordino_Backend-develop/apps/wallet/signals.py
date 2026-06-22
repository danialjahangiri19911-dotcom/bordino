from django.db import transaction
from django.db.models.signals import post_delete, post_save, pre_save
from django.dispatch import receiver

from apps.wallet.models.transactions.activity import ActivityTransaction
from apps.wallet.models.transactions.lottery_ticket import LotteryTicketTransaction
from apps.wallet.models.transactions.referral import ReferralRewardTransaction
from apps.wallet.models.transactions.token import TokenTransaction
from apps.wallet.repositories.token_wallet_account.query import TokenWalletAccountQueryRepository
from apps.wallet.services.token_wallet_account.creation import TokenWalletAccountCreationService


@receiver(post_save, sender=LotteryTicketTransaction)
def update_wallet_on_ticket_transaction(sender, instance, created, **kwargs):
    with transaction.atomic():
        wallet_account = instance.source_wallet
        amount = int(instance.amount)

        if instance.status == LotteryTicketTransaction.Status.COMPLETED:
            if created or (
                hasattr(instance, "_previous_status")
                and instance._previous_status != LotteryTicketTransaction.Status.COMPLETED
            ):
                wallet_account.amount -= amount
                wallet_account.save(update_fields=["amount"])
        elif (
            hasattr(instance, "_previous_status")
            and instance._previous_status == LotteryTicketTransaction.Status.COMPLETED
        ):
            wallet_account.amount += amount
            wallet_account.save(update_fields=["amount"])


@receiver(pre_save, sender=LotteryTicketTransaction)
def store_previous_status_ticket(sender, instance, **kwargs):
    if instance.pk:
        try:
            old_instance = LotteryTicketTransaction.objects.get(pk=instance.pk)
            instance._previous_status = old_instance.status
        except LotteryTicketTransaction.DoesNotExist:
            instance._previous_status = None
    else:
        instance._previous_status = None


@receiver(post_delete, sender=LotteryTicketTransaction)
def reverse_wallet_on_ticket_transaction_delete(sender, instance, **kwargs):
    if instance.status == LotteryTicketTransaction.Status.COMPLETED:
        with transaction.atomic():
            wallet_account = instance.source_wallet
            amount_to_add = int(instance.amount)
            wallet_account.amount += amount_to_add
            wallet_account.save(update_fields=["amount"])


@receiver(post_save, sender=ReferralRewardTransaction)
def update_wallet_on_referral_reward(sender, instance, created, **kwargs):
    with transaction.atomic():
        query_repo = TokenWalletAccountQueryRepository()
        wallet_account = query_repo.filter_by_customer_and_token(
            instance.referrer, instance.token
        ).first()

        if not wallet_account:
            creation_service = TokenWalletAccountCreationService()
            wallet_account = creation_service.create_token_wallet_account_by_system(
                creation_service.CreateTokenWalletAccountDTO(
                    wallet=instance.referrer.user.wallet,
                    name=f"کیف پول {instance.token.symbol}",
                    symbol=instance.token.symbol,
                )
            )

        amount = instance.tokens_amount

        if instance.status == ReferralRewardTransaction.Status.COMPLETED:
            if created or (
                hasattr(instance, "_previous_status")
                and instance._previous_status != ReferralRewardTransaction.Status.COMPLETED
            ):
                wallet_account.amount += amount
                wallet_account.save(update_fields=["amount"])
        elif (
            hasattr(instance, "_previous_status")
            and instance._previous_status == ReferralRewardTransaction.Status.COMPLETED
        ):
            wallet_account.amount -= amount
            wallet_account.save(update_fields=["amount"])


@receiver(pre_save, sender=ReferralRewardTransaction)
def store_previous_status_referral(sender, instance, **kwargs):
    if instance.pk:
        try:
            old_instance = ReferralRewardTransaction.objects.get(pk=instance.pk)
            instance._previous_status = old_instance.status
        except ReferralRewardTransaction.DoesNotExist:
            instance._previous_status = None
    else:
        instance._previous_status = None


@receiver(post_delete, sender=ReferralRewardTransaction)
def reverse_wallet_on_referral_reward_delete(sender, instance, **kwargs):
    if instance.status == ReferralRewardTransaction.Status.COMPLETED:
        with transaction.atomic():
            query_repo = TokenWalletAccountQueryRepository()
            wallet_account = query_repo.filter_by_customer_and_token(
                instance.referrer, instance.token
            ).first()

            if wallet_account:
                amount_to_deduct = instance.tokens_amount
                wallet_account.amount -= amount_to_deduct
                wallet_account.save(update_fields=["amount"])


@receiver(post_save, sender=TokenTransaction)
def update_wallet_on_token_transaction(sender, instance, created, **kwargs):
    with transaction.atomic():
        amount = int(instance.amount)
        source_wallet = instance.source_wallet
        destination_wallet = instance.destination_wallet

        if instance.status == TokenTransaction.Status.COMPLETED:
            if created or (
                hasattr(instance, "_previous_status")
                and instance._previous_status != TokenTransaction.Status.COMPLETED
            ):
                source_wallet.amount -= amount
                source_wallet.save(update_fields=["amount"])

                destination_wallet.amount += amount
                destination_wallet.save(update_fields=["amount"])
        elif (
            hasattr(instance, "_previous_status")
            and instance._previous_status == TokenTransaction.Status.COMPLETED
        ):
            source_wallet.amount += amount
            source_wallet.save(update_fields=["amount"])

            destination_wallet.amount -= amount
            destination_wallet.save(update_fields=["amount"])


@receiver(pre_save, sender=TokenTransaction)
def store_previous_status_token(sender, instance, **kwargs):
    if instance.pk:
        try:
            old_instance = TokenTransaction.objects.get(pk=instance.pk)
            instance._previous_status = old_instance.status
        except TokenTransaction.DoesNotExist:
            instance._previous_status = None
    else:
        instance._previous_status = None


@receiver(post_delete, sender=TokenTransaction)
def reverse_wallet_on_token_transaction_delete(sender, instance, **kwargs):
    if instance.status == TokenTransaction.Status.COMPLETED:
        with transaction.atomic():
            amount = int(instance.amount)
            source_wallet = instance.source_wallet
            destination_wallet = instance.destination_wallet

            source_wallet.amount += amount
            source_wallet.save(update_fields=["amount"])

            destination_wallet.amount -= amount
            destination_wallet.save(update_fields=["amount"])


@receiver(post_save, sender=ActivityTransaction)
def update_wallet_on_activity_transaction(sender, instance, created, **kwargs):
    if instance.score_value is None:
        return

    with transaction.atomic():
        query_repo = TokenWalletAccountQueryRepository()
        wallet_account = query_repo.get_last_active_for_customer(instance.customer)

        if not wallet_account:
            return

        amount = instance.score_value

        if instance.status == ActivityTransaction.Status.COMPLETED:
            if created or (
                hasattr(instance, "_previous_status")
                and instance._previous_status != ActivityTransaction.Status.COMPLETED
            ):
                wallet_account.amount += amount
                wallet_account.save(update_fields=["amount"])
        elif (
            hasattr(instance, "_previous_status")
            and instance._previous_status == ActivityTransaction.Status.COMPLETED
        ):
            wallet_account.amount -= amount
            wallet_account.save(update_fields=["amount"])


@receiver(pre_save, sender=ActivityTransaction)
def store_previous_status_activity(sender, instance, **kwargs):
    if instance.pk:
        try:
            old_instance = ActivityTransaction.objects.get(pk=instance.pk)
            instance._previous_status = old_instance.status
        except ActivityTransaction.DoesNotExist:
            instance._previous_status = None
    else:
        instance._previous_status = None


@receiver(post_delete, sender=ActivityTransaction)
def reverse_wallet_on_activity_transaction_delete(sender, instance, **kwargs):
    if instance.status == ActivityTransaction.Status.COMPLETED and instance.score_value:
        with transaction.atomic():
            query_repo = TokenWalletAccountQueryRepository()
            wallet_account = query_repo.get_last_active_for_customer(instance.customer)

            if wallet_account:
                amount_to_deduct = instance.score_value
                wallet_account.amount -= amount_to_deduct
                wallet_account.save(update_fields=["amount"])
