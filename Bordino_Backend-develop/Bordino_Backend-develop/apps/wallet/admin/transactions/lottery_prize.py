from django.contrib import admin, messages

from apps.django_helper.admin.base import BaseAdmin
from apps.wallet.models.transactions.lottery_prize import LotteryPrizeTransaction
from apps.wallet.admin.safe_save import ReadOnlyLedgerAdmin


@admin.register(LotteryPrizeTransaction)
class LotteryPrizeTransactionAdmin(ReadOnlyLedgerAdmin, BaseAdmin):
    list_display = ("id", "lottery", "ticket", "prize_amount", "status", "create_time")
    list_filter = ("status",)
    actions = ("pay_pending",)

    @admin.action(description="پرداخت جایزه‌های در انتظار (وقتی کیف نقدی برنده درست شد)")
    def pay_pending(self, request, queryset):
        from apps.lottery.services.lottery.lottery_winner import pay_pending_prize  # pylint: disable=import-outside-toplevel

        if not request.user.is_superuser:
            self.message_user(request, "فقط مدیر اصلی می‌تواند جایزه پرداخت کند.", messages.ERROR)
            return
        paid = sum(1 for pk in queryset.values_list("pk", flat=True) if pay_pending_prize(pk))
        self.message_user(request, f"{paid} جایزه پرداخت شد؛ بقیه یا در انتظار نبودند یا هنوز کیف نقدی برنده آماده نیست.")
