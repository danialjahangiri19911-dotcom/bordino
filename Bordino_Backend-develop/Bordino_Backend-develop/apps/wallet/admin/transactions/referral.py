from django.contrib import admin

from apps.django_helper.admin.base import BaseAdmin
from apps.wallet.models.transactions.referral import ReferralRewardTransaction
from apps.wallet.admin.safe_save import ReadOnlyLedgerAdmin


@admin.register(ReferralRewardTransaction)
class ReferralRewardTransactionAdmin(ReadOnlyLedgerAdmin, BaseAdmin):
    autocomplete_fields = ("referrer", "buyer")
    list_display = (
        "id",
        "referrer",
        "buyer",
        "token",
        "tokens_amount",
        "level",
        "status",
        "create_time",
    )
