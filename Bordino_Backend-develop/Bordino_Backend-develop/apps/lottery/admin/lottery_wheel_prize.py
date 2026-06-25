from django import forms
from django.contrib import admin
from django.contrib.admin import register
from django.core.exceptions import ValidationError
from django.forms.models import BaseInlineFormSet
from django.utils.translation import gettext_lazy as _

from apps.django_helper.admin.base import BaseAdmin
from apps.lottery.models import LotteryWheelPrize


class LotteryWheelPrizeForm(forms.ModelForm):
    """فرمِ جایزه با توضیحِ کاربردیِ هر پارامتر."""

    class Meta:
        model = LotteryWheelPrize
        fields = "__all__"
        help_texts = {
            "name": _(
                "نامِ جایزه؛ همین متن روی پرهٔ گردونه و در پیامِ برد نمایش داده می‌شود "
                "(مثل «۱۰۰٬۰۰۰ تومان» یا «۱۰۰ امتیاز» یا «پوچ»). اگر شاملِ کلمهٔ «امتیاز» باشد "
                "فرانت پیامِ «کیف امتیاز» نشان می‌دهد، وگرنه «کیف پول نقدی»."
            ),
            "prize_amount": _(
                "مقدارِ جایزه. نقدی=تومان (به کیف نقدی)، امتیازی=تعداد امتیاز (به کیف امتیاز)، پوچ=۰."
            ),
            "probability": _(
                "شانسِ این جایزه (۰ تا ۱۰۰). مجموعِ احتمالِ همهٔ جوایزِ یک گردونه باید دقیقاً ۱۰۰ باشد، "
                "وگرنه ذخیره نمی‌شود. هرچه بیشتر = احتمالِ برده‌شدن و هزینهٔ بیزینس بیشتر."
            ),
            "prize_type": _(
                "cash=واریز به کیفِ نقدی | recharge=واریز امتیاز به کیفِ امتیاز | empty=پوچ (بدون واریز)."
            ),
            "target_token": _(
                "فقط برای جایزهٔ امتیازی (recharge): کیفِ امتیازِ مقصد. خالی = همان کیفی که هزینهٔ چرخش "
                "از آن کم شد (پیش‌فرض)."
            ),
        }


class LotteryWheelPrizeInlineFormSet(BaseInlineFormSet):
    """مجموعِ احتمالِ جوایزِ یک گردونه باید دقیقاً ۱۰۰ باشد."""

    def clean(self):
        super().clean()

        total = 0
        count = 0
        for form in self.forms:
            if not hasattr(form, "cleaned_data"):
                continue
            cleaned = form.cleaned_data
            if not cleaned or cleaned.get("DELETE"):
                continue
            probability = cleaned.get("probability")
            if probability is None:
                continue
            total += probability
            count += 1

        if count > 0 and total != 100:
            raise ValidationError(
                _("مجموع احتمال جوایز باید دقیقاً ۱۰۰ باشد (مقدار فعلی: %(total)s).")
                % {"total": total}
            )


class LotteryWheelPrizeInline(admin.TabularInline):
    model = LotteryWheelPrize
    form = LotteryWheelPrizeForm
    formset = LotteryWheelPrizeInlineFormSet
    extra = 1
    verbose_name = _("جایزه")
    verbose_name_plural = _(
        "جوایزِ گردونه (هر ردیف = یک پره؛ مجموعِ احتمال‌ها باید ۱۰۰ شود)"
    )


@register(LotteryWheelPrize)
class LotteryWheelPrizeAdmin(BaseAdmin):
    form = LotteryWheelPrizeForm
    list_display = (
        "id",
        "lottery_wheel",
        "name",
        "prize_amount",
        "probability",
        "prize_type",
        "target_token",
    )
    list_filter = ("prize_type", "lottery_wheel")
    search_fields = ("name",)
