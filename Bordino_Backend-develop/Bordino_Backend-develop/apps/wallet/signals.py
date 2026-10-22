from django.core.exceptions import ValidationError
from django.db import connection, transaction
from django.db.models.signals import post_delete, post_save, pre_delete, pre_save
from django.dispatch import receiver
from django.utils.translation import gettext_lazy as _

from apps.wallet.models.transactions.activity import ActivityTransaction
from apps.wallet.models.currency_wallet_account import CurrencyWalletAccount
from apps.wallet.models.transactions.currency import CurrencyTransaction
from apps.wallet.models.transactions.lottery_ticket import LotteryTicketTransaction
from apps.wallet.models.transactions.referral import ReferralRewardTransaction
from apps.wallet.models.transactions.token import TokenTransaction
from apps.wallet.repositories.token_wallet_account.query import TokenWalletAccountQueryRepository
from apps.wallet.services import balance
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
                balance.add_points(wallet_account, -amount)
        elif (
            hasattr(instance, "_previous_status")
            and instance._previous_status == LotteryTicketTransaction.Status.COMPLETED
        ):
            balance.add_points(wallet_account, amount)


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
            balance.add_points(wallet_account, int(instance.amount))


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
                    wallet=balance.customer_wallet(instance.referrer.user),
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
                balance.add_points(wallet_account, amount)
        elif (
            hasattr(instance, "_previous_status")
            and instance._previous_status == ReferralRewardTransaction.Status.COMPLETED
        ):
            balance.add_points(wallet_account, -amount)


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
                balance.add_points(wallet_account, -instance.tokens_amount)


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
                balance.add_points(source_wallet, -amount)
                balance.add_points(destination_wallet, amount)
        elif (
            hasattr(instance, "_previous_status")
            and instance._previous_status == TokenTransaction.Status.COMPLETED
        ):
            balance.add_points(source_wallet, amount)
            balance.add_points(destination_wallet, -amount)


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

            balance.add_points(source_wallet, amount)
            balance.add_points(destination_wallet, -amount)


@receiver(post_save, sender=ActivityTransaction)
def update_wallet_on_activity_transaction(sender, instance, created, **kwargs):
    if instance.score_value is None:
        return

    with transaction.atomic():
        # The points (L) account, not "the newest account" (which could hold another token).
        wallet_account = balance.points_account(instance.customer.user)

        if not wallet_account:
            return

        amount = instance.score_value

        if instance.status == ActivityTransaction.Status.COMPLETED:
            if created or (
                hasattr(instance, "_previous_status")
                and instance._previous_status != ActivityTransaction.Status.COMPLETED
            ):
                balance.add_points(wallet_account, amount)
        elif (
            hasattr(instance, "_previous_status")
            and instance._previous_status == ActivityTransaction.Status.COMPLETED
        ):
            balance.add_points(wallet_account, -amount)


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
            wallet_account = balance.points_account(instance.customer.user)

            if wallet_account:
                balance.add_points(wallet_account, -instance.score_value)


# ---- Withdrawals (CurrencyTransaction from a customer account to a bank account) ----------------
# The amount is taken from the balance when the withdrawal is requested. If it then fails or is
# cancelled (by an admin), or a pending one is deleted, the amount goes back, exactly once.


def _is_withdrawal(instance):
    return instance.source_wallet_id is not None and instance.bank_account_id is not None


_RESERVATION = ("status", "amount", "source_wallet_id", "bank_account_id")


def _stored(instance):
    """The transaction as stored, locked until the caller's transaction commits (the admin saves
    and deletes inside one): what a refund is based on, never the possibly stale or edited
    in-memory copy."""
    rows = CurrencyTransaction.objects.filter(pk=instance.pk)
    if connection.in_atomic_block:
        rows = rows.select_for_update()
    return rows.values(*_RESERVATION).first()


@receiver(pre_save, sender=CurrencyTransaction)
def store_previous_status_currency(sender, instance, **kwargs):
    instance._stored = _stored(instance) if instance.pk else None
    instance._previous_status = instance._stored["status"] if instance._stored else None
    # Checked again here, under the lock: two admins may both have passed full_clean while it
    # was pending; the second one finds it finished and is refused.
    if (
        instance._stored
        and instance._stored["status"] in CurrencyTransaction.FINAL
        and instance.status != instance._stored["status"]
    ):
        raise ValidationError(
            {"status": _("A finished transaction cannot change its status.")}
        )
    if instance._stored:
        # What was reserved does not change after the request: amount, account and bank stay.
        instance.amount = instance._stored["amount"]
        instance.source_wallet_id = instance._stored["source_wallet_id"]
        instance.bank_account_id = instance._stored["bank_account_id"]


def _refund(stored):
    account = CurrencyWalletAccount.objects.filter(pk=stored["source_wallet_id"]).first()
    if account:
        balance.add_currency(account, stored["amount"])


@receiver(post_save, sender=CurrencyTransaction)
def refund_failed_withdrawal(sender, instance, created, **kwargs):
    stored = getattr(instance, "_stored", None)
    if created or not stored or stored["bank_account_id"] is None:
        return
    given_back = (CurrencyTransaction.Status.FAILED, CurrencyTransaction.Status.CANCELLED)
    if stored["status"] == CurrencyTransaction.Status.PENDING and instance.status in given_back:
        _refund(stored)


@receiver(pre_delete, sender=CurrencyTransaction)
def store_deleted_withdrawal(sender, instance, **kwargs):
    instance._stored = _stored(instance)


@receiver(post_delete, sender=CurrencyTransaction)
def refund_deleted_pending_withdrawal(sender, instance, **kwargs):
    # By the stored status: a copy loaded before another admin marked it failed (refunded) or
    # completed (paid) must not refund again.
    stored = getattr(instance, "_stored", None)
    if (
        stored
        and stored["bank_account_id"] is not None
        and stored["source_wallet_id"] is not None
        and stored["status"] == CurrencyTransaction.Status.PENDING
    ):
        _refund(stored)
