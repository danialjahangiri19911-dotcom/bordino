"""What sends a notification on its own: account events (bank account checked, withdrawal paid or
returned) and a new lottery. Lottery results are sent by LotteryWinnerService after a draw."""

from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from apps.lottery.models import Lottery
from apps.notifications import services
from apps.notifications.models import Category
from apps.wallet.models import BankAccount, CurrencyTransaction

_FA = str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹")


def toman(amount) -> str:
    return f"{int(amount):,}".replace(",", "٬").translate(_FA)


@receiver(pre_save, sender=BankAccount)
def _bank_account_before(sender, instance, **kwargs):
    instance._previous_status = (
        BankAccount.objects.filter(pk=instance.pk).values_list("status", flat=True).first() if instance.pk else None
    )


@receiver(post_save, sender=BankAccount)
def _bank_account_checked(sender, instance, created, **kwargs):
    before = getattr(instance, "_previous_status", None)
    if created or before == instance.status or not hasattr(instance.user, "customer"):
        return
    customer = instance.user.customer
    if instance.status == BankAccount.Status.APPROVED:
        services.queue(
            customer, Category.ACCOUNT, "حساب بانکی‌ات تأیید شد",
            f"از این به بعد می‌توانی به «{instance.bank.name}» برداشت کنی.", "/pwa/wallet/withdraw",
            key=f"bank-account:{instance.pk}:approved",
        )
    elif instance.status == BankAccount.Status.REJECTED:
        services.queue(
            customer, Category.ACCOUNT, "حساب بانکی‌ات تأیید نشد",
            "شماره شبا یا نام صاحب حساب را بررسی کن و دوباره ثبت کن.", "/pwa/wallet/withdraw",
            key=f"bank-account:{instance.pk}:rejected",
        )


@receiver(post_save, sender=CurrencyTransaction)
def _withdrawal_finished(sender, instance, created, **kwargs):
    # A withdrawal is a currency transaction to a bank account; wallet/signals.py stores the old status.
    if created or not instance.bank_account_id:
        return
    before = getattr(instance, "_previous_status", None)
    if before == instance.status or before != CurrencyTransaction.Status.PENDING:
        return
    owner = instance.bank_account.user
    if not hasattr(owner, "customer"):
        return
    amount = toman(instance.amount)
    if instance.status == CurrencyTransaction.Status.COMPLETED:
        title, body = "برداشت واریز شد", f"{amount} تومان به حساب بانکی‌ات واریز شد."
    elif instance.status in (CurrencyTransaction.Status.FAILED, CurrencyTransaction.Status.CANCELLED):
        title, body = "برداشت انجام نشد", f"{amount} تومان به کیف پولت برگشت."
    else:
        return
    services.queue(owner.customer, Category.ACCOUNT, title, body, "/pwa/wallet", key=f"withdrawal:{instance.pk}:{instance.status}")


@receiver(pre_save, sender=Lottery)
def _lottery_before(sender, instance, **kwargs):
    instance._previous_status = (
        Lottery.objects.filter(pk=instance.pk).values_list("status", flat=True).first() if instance.pk else None
    )


@receiver(post_save, sender=Lottery)
def _new_lottery(sender, instance, created, **kwargs):
    # Opened: created active, or a draft switched to active.
    if instance.status == Lottery.Status.ACTIVE and getattr(instance, "_previous_status", None) != Lottery.Status.ACTIVE:
        services.queue_broadcast(
            Category.LOTTERY, "قرعه‌کشی تازه شروع شد", f"«{instance.name}» باز است؛ بلیتت را بگیر.",
            f"/pwa/lottery/lottery-detail/{instance.pk}", key=f"lottery-new:{instance.pk}",
        )


def lottery_drawn(lottery):
    """Called after the winners are settled: every ticket holder hears the result once."""
    from apps.lottery.models.ticket import Ticket  # pylint: disable=import-outside-toplevel
    from apps.users.models.customer import Customer  # pylint: disable=import-outside-toplevel

    holders = Customer.objects.filter(pk__in=Ticket.objects.filter(lottery=lottery).values("customer"))
    for customer in holders:
        services.queue(
            customer, Category.LOTTERY, "نتیجهٔ قرعه‌کشی اعلام شد",
            f"عددهای برندهٔ «{lottery.name}» آمد؛ ببین بلیت‌هایت برنده شده‌اند یا نه.",
            f"/pwa/lottery/lottery-detail/{lottery.pk}", key=f"lottery-result:{lottery.pk}",
        )
