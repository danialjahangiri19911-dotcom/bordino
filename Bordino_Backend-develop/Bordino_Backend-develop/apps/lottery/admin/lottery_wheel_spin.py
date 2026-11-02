from django.contrib.admin import register

from apps.django_helper.admin.base import BaseAdmin
from apps.lottery.models import LotteryWheelSpin
from apps.wallet.admin.safe_save import ReadOnlyLedgerAdmin


@register(LotteryWheelSpin)
class LotteryWheelSpinAdmin(ReadOnlyLedgerAdmin, BaseAdmin):
    """How many spins each player has used: written by the spins themselves (a stale edit here
    gave spent spins back)."""

    autocomplete_fields = ("customer",)
    list_display = (
        "id",
        "customer",
        "lottery_wheel",
        "count",
    )
