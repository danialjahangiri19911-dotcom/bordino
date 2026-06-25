from django import forms
from django.contrib.admin import register
from django.utils.translation import gettext_lazy as _

from apps.django_helper.admin.base import BaseAdmin
from apps.lottery.admin.lottery_wheel_prize import LotteryWheelPrizeInline
from apps.lottery.models import LotteryWheel


class LotteryWheelForm(forms.ModelForm):
    """فرمِ گردونه با توضیحِ کاربردیِ هر پارامتر."""

    class Meta:
        model = LotteryWheel
        fields = "__all__"
        help_texts = {
            "name": _("نامِ گردونه (حداکثر ۲۰ کاراکتر)؛ در عنوانِ صفحهٔ گردونه نمایش داده می‌شود."),
            "owner": _("اسپانسر/مالکِ گردونه."),
            "tokens_whitelist": _(
                "کیف‌های امتیازی‌ای که کاربر می‌تواند با آن‌ها هزینهٔ چرخش را بپردازد. "
                "اگر چند کیف انتخاب شود، فرانت معمولاً اولین/مناسب را برای پرداخت استفاده می‌کند."
            ),
            "cost_per_spin": _(
                "امتیازی که بابتِ هر چرخش از کیفِ امتیازِ کاربر کم می‌شود. ۰ = چرخشِ رایگان. "
                "منبعِ اصلیِ درآمد/کنترلِ هزینهٔ گردونه."
            ),
            "max_spins": _("سقفِ کلِ چرخش‌های مجاز روی این گردونه (همهٔ کاربران). با رسیدن به سقف، چرخش متوقف می‌شود."),
            "max_spins_per_customer": _("سقفِ چرخشِ مجاز برای هر کاربر روی این گردونه."),
            "status": _("active = در فرانت نمایش و قابلِ چرخش | inactive = مخفی و غیرفعال."),
        }


@register(LotteryWheel)
class LotteryWheelAdmin(BaseAdmin):
    form = LotteryWheelForm
    autocomplete_fields = ("owner",)
    filter_horizontal = ("tokens_whitelist",)
    inlines = [LotteryWheelPrizeInline]
    list_display = (
        "id",
        "name",
        "owner",
        "cost_per_spin",
        "max_spins_per_customer",
        "status",
        "display_tokens_whitelist",
    )
    list_filter = ("status",)
    search_fields = ("name",)

    fieldsets = (
        (
            _("گردونهٔ شانس"),
            {
                "description": _(
                    "<b>سازوکار:</b> کاربر «بگردون» را می‌زند → به‌ازای هر چرخش "
                    "<i>هزینهٔ چرخش</i> از کیفِ امتیازش کم می‌شود → سرور بر اساسِ "
                    "<i>احتمالِ</i> جوایز یکی را به‌صورت وزنی انتخاب می‌کند → جایزه به کیفِ "
                    "مناسب واریز می‌شود. جوایز را در جدولِ پایین تعریف کن."
                ),
                "fields": ("name", "owner", "status"),
            },
        ),
        (
            _("پرداخت و کیف‌پول"),
            {
                "description": _(
                    "تعیین می‌کند چرخش با کدام کیفِ امتیاز پرداخت شود و هزینهٔ هر چرخش چقدر باشد."
                ),
                "fields": ("tokens_whitelist", "cost_per_spin"),
            },
        ),
        (
            _("محدودیتِ چرخش"),
            {
                "description": _("کنترلِ تعدادِ چرخش برای مدیریتِ هزینه و جلوگیری از سوءاستفاده."),
                "fields": ("max_spins", "max_spins_per_customer"),
            },
        ),
    )

    def display_tokens_whitelist(self, obj):
        return ", ".join([token.symbol for token in obj.tokens_whitelist.all()])

    display_tokens_whitelist.short_description = _("کیف‌های مجاز پرداخت")  # type: ignore[attr-defined]
