from django import forms
from django.contrib import admin, messages
from django.contrib.admin import register
from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _

from apps.django_helper.admin.base import BaseAdmin
from apps.lottery.admin.prize_rule import PrizeRuleInline
from apps.lottery.models import Lottery
from apps.lottery.services.lottery.lottery_winner import LotteryWinnerService


class LotteryForm(forms.ModelForm):
    class Meta:
        model = Lottery
        fields = "__all__"
        help_texts = {
            "name": _("نامِ قرعه‌کشی (حداکثر ۲۰ کاراکتر)."),
            "owner": _("اسپانسر/مالکِ قرعه‌کشی."),
            "token": _("بلیطِ این قرعه‌کشی با کدام نوعِ امتیاز (Token) خریداری می‌شود."),
            "balance": _("موجودیِ صندوقِ جوایزِ این قرعه‌کشی."),

            "ticket_price": _("قیمتِ هر بلیط (به واحدِ امتیازِ همان Token)."),
            "status": _(
                "draft=پیش‌نویس | active=فعال (نیازمندِ تاریخِ شروع/پایانِ معتبر) | "
                "completed=پایان‌یافته | cancelled=لغوشده."
            ),
            "start_date": _("زمانِ شروع. برای فعال‌سازی الزامی است."),
            "end_date": _("زمانِ پایان. باید بعد از شروع و در آینده باشد (برای حالتِ active)."),
        }


@register(Lottery)
class LotteryAdmin(BaseAdmin):
    form = LotteryForm
    autocomplete_fields = ("owner",)
    inlines = [PrizeRuleInline]
    list_display = (
        "id",
        "name",
        "owner",
        "token",
        "balance",
        "ticket_price",
        "status",
    )
    list_filter = ("status",)
    search_fields = ("name",)
    actions = ["run_process"]
    # Drawn by the server at settlement (random, after sales close); shown, never typed in.
    readonly_fields = ("numbers",)

    def get_readonly_fields(self, request, obj=None):
        fields = tuple(super().get_readonly_fields(request, obj))
        # Once tickets are sold, the lottery ends only through the draw (the «run_process» action),
        # which pays its winners: a status typed in here would skip that, and the unit and price
        # of what was bought stay as they were.
        if obj is not None and obj.tickets.exists():
            fields += tuple(f for f in ("status", "token", "ticket_price") if f not in fields)
        return fields

    def save_model(self, request, obj, form, change):
        if not change:
            return super().save_model(request, obj, form, change)
        # Only what the form changed: the pool counters (balance, points spent) move with every
        # ticket bought, and a copy loaded before a purchase must not write them back.
        fields = [f for f in form.changed_data if f in {fl.name for fl in obj._meta.concrete_fields}]
        if fields:
            obj.save(update_fields=[*fields, "update_time"])
        return None

    fieldsets = (
        (
            _("قرعه‌کشی"),
            {
                "description": _(
                    "<b>سازوکار:</b> کاربر با امتیاز بلیط می‌خرد و ۶ شماره انتخاب می‌کند. در پایان، "
                    "۶ شمارهٔ برنده مشخص می‌شود و بر اساسِ «تعدادِ شماره‌های درست» طبقِ «قوانینِ جایزه» "
                    "جایزه پرداخت می‌شود. محاسبهٔ برندگان با Action «اجرای محاسبهٔ برندگان» انجام می‌شود."
                ),
                "fields": ("name", "owner", "status"),
            },
        ),
        (
            _("بلیط و جوایز"),
            {
                "description": _("نوعِ امتیازِ بلیط، قیمتِ بلیط، صندوقِ جایزه و ۶ شمارهٔ برنده."),
                "fields": ("token", "ticket_price", "balance", "numbers"),
            },
        ),
        (
            _("بازهٔ زمانی"),
            {
                "description": _("برای حالتِ active، تاریخِ شروع و پایانِ معتبر الزامی است."),
                "fields": ("start_date", "end_date"),
            },
        ),
    )

    @admin.action(description=_("اجرای محاسبهٔ برندگان روی قرعه‌کشی‌های انتخاب‌شده"))
    def run_process(self, request, queryset):
        for obj in queryset:
            service = LotteryWinnerService(obj)
            try:
                result = service.process_winners()
            except ValidationError as exc:
                self.message_user(request, f"{obj.name}: {' '.join(exc.messages)}", messages.ERROR)
                continue
            self.message_user(
                request,
                f"Successfully processed lottery {obj.name}:\n"
                f"Total winners: {result['total_winners']}\n"
                f"Total prize amount: {result['total_prize_amount']}",
                messages.SUCCESS,
            )
