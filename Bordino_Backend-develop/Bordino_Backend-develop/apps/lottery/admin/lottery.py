from django.contrib import admin, messages
from django.contrib.admin import register

from apps.django_helper.admin.base import BaseAdmin
from apps.lottery.admin.prize_rule import PrizeRuleInline
from apps.lottery.models import Lottery
from apps.lottery.services.lottery.lottery_winner import LotteryWinnerService


@register(Lottery)
class LotteryAdmin(BaseAdmin):
    autocomplete_fields = ("owner",)
    inlines = [PrizeRuleInline]
    list_display = (
        "id",
        "name",
        "owner",
        "token",
        "balance",
        "numbers",
        "status",
    )
    actions = ["run_process"]

    @admin.action(description="Run process on selected lottery")
    def run_process(self, request, queryset):
        for obj in queryset:
            service = LotteryWinnerService(obj)
            result = service.process_winners()
            self.message_user(
                request,
                f"Process run on selected lotteries\n"
                f"Successfully processed lottery {obj.name}:\n"
                f"Total winners: {result['total_winners']}\n"
                f"Total prize amount: {result['total_prize_amount']}",
                messages.SUCCESS,
            )
