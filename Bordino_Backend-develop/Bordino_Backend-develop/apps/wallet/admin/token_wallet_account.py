from django import forms
from django.contrib import admin, messages
from django.contrib.admin import register
from django.utils.translation import gettext_lazy as _

from apps.django_helper.admin.base import BaseAdmin
from apps.wallet.models.token_wallet_account import TokenWalletAccount


class TokenWalletAccountForm(forms.ModelForm):
    class Meta:
        model = TokenWalletAccount
        fields = "__all__"
        help_texts = {
            "amount": _(
                "موجودیِ امتیازِ این کاربر در این کیف. برای کم/زیاد کردن، همین عدد را تغییر بده و ذخیره کن "
                "(یا در فهرست مستقیماً ویرایش کن). همین مقدار است که هزینهٔ چرخشِ گردونه از آن کم می‌شود."
            ),
            "token": _("این کیف به کدام نوعِ امتیاز (Token) تعلق دارد."),
            "wallet": _("کیف‌پولِ کاربر که این حساب زیرمجموعهٔ آن است."),
            "status": _("وضعیتِ حساب؛ برای استفادهٔ عادی باید valid باشد."),
        }


@register(TokenWalletAccount)
class TokenWalletAccountAdmin(BaseAdmin):
    form = TokenWalletAccountForm
    list_display = (
        "id",
        "name",
        "wallet",
        "token",
        "amount",
        "status",
    )
    list_editable = ("amount",)
    list_filter = ("token", "status")
    search_fields = ("wallet__user__phone_number", "token__symbol", "name")
    actions = ("add_100", "add_1000", "subtract_100")

    fieldsets = (
        (
            _("کیفِ امتیازِ کاربر"),
            {
                "description": _(
                    "<b>کم/زیادِ امتیاز اینجا انجام می‌شود.</b> فیلدِ «amount» موجودیِ امتیازِ کاربر است؛ "
                    "آن را تغییر بده و ذخیره کن، یا در فهرست ردیف‌ها را انتخاب کن و از منوی «Action» "
                    "از دکمه‌های افزودن/کسرِ سریع استفاده کن. تغییرات بلافاصله روی دیتابیس اعمال می‌شود."
                ),
                "fields": ("name", "wallet", "preset_wallet", "token", "amount", "status"),
            },
        ),
    )

    def _adjust(self, request, queryset, delta):
        updated = 0
        for account in queryset:
            account.amount = (account.amount or 0) + delta
            account.save()
            updated += 1
        self.message_user(
            request,
            _("%(n)s کیف به‌اندازهٔ %(d)s امتیاز تغییر کرد.") % {"n": updated, "d": delta},
            messages.SUCCESS,
        )

    @admin.action(description=_("➕ افزودن ۱۰۰ امتیاز به انتخاب‌شده‌ها"))
    def add_100(self, request, queryset):
        self._adjust(request, queryset, 100)

    @admin.action(description=_("➕ افزودن ۱۰۰۰ امتیاز به انتخاب‌شده‌ها"))
    def add_1000(self, request, queryset):
        self._adjust(request, queryset, 1000)

    @admin.action(description=_("➖ کسر ۱۰۰ امتیاز از انتخاب‌شده‌ها"))
    def subtract_100(self, request, queryset):
        self._adjust(request, queryset, -100)
