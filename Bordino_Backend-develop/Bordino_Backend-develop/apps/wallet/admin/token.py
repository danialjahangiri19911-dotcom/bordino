from django import forms
from django.contrib.admin import register
from django.utils.translation import gettext_lazy as _

from apps.django_helper.admin.base import BaseAdmin
from apps.wallet.models.token import Token


class TokenForm(forms.ModelForm):
    class Meta:
        model = Token
        fields = "__all__"
        help_texts = {
            "symbol": _("نمادِ کوتاه و یکتا (حروفِ بزرگِ انگلیسی)، مثل «L». شناسهٔ این نوع امتیاز."),
            "name": _("نامِ نمایشیِ کیفِ امتیاز، مثل «کیف پول امتیاز بردینو»."),
            "price": _("ارزشِ هر واحدِ این امتیاز (برای تبدیل/محاسبات). اگر کاربرد ندارد ۱ بگذار."),
            "owner": _("اسپانسر/مالکِ این نوع امتیاز (اختیاری)."),
            "logo": _("لوگوی کیفِ امتیاز (اختیاری)."),
        }


@register(Token)
class TokenAdmin(BaseAdmin):
    form = TokenForm
    autocomplete_fields = ("owner", "logo")
    search_fields = ("symbol", "name")
    list_display = (
        "id",
        "name",
        "symbol",
        "owner",
        "price",
    )

    fieldsets = (
        (
            _("کیفِ امتیاز (Token)"),
            {
                "description": _(
                    "<b>هر Token یک نوع «کیفِ امتیاز» است.</b> برای داشتنِ چند کیفِ امتیاز "
                    "(مثلاً «امتیاز ۱» و «امتیاز ۲») چند Token بساز؛ سپس در جوایزِ امتیازیِ گردونه "
                    "با فیلدِ «کیفِ امتیازِ مقصد» تعیین کن کدام شارژ شود. موجودیِ هر کاربر در بخشِ "
                    "«TokenWalletAccount / کیف‌های امتیازِ کاربران» مدیریت می‌شود."
                ),
                "fields": ("name", "symbol", "price", "owner", "logo"),
            },
        ),
    )
