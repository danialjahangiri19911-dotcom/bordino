from django.contrib.admin import register
from django.utils.translation import gettext as _

from apps.django_helper.admin.base import BaseAdmin
from apps.lottery.admin.lottery_wheel_prize import LotteryWheelPrizeInline
from apps.lottery.models import LotteryWheel


@register(LotteryWheel)
class LotteryWheelAdmin(BaseAdmin):
    autocomplete_fields = ("owner",)
    inlines = [LotteryWheelPrizeInline]
    list_display = (
        "id",
        "name",
        "owner",
        "display_tokens_whitelist",
    )

    def display_tokens_whitelist(self, obj):
        return ", ".join([token.symbol for token in obj.tokens_whitelist.all()])

    display_tokens_whitelist.short_description = _("Tokens Whitelist")  # type: ignore[attr-defined]
