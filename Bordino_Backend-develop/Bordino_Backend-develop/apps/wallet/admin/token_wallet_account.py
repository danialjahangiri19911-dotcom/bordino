from django import forms
from django.contrib import admin, messages
from django.contrib.admin import register
from django.utils.translation import gettext_lazy as _

from apps.django_helper.admin.base import BaseAdmin
from apps.wallet.models.token_wallet_account import TokenWalletAccount
from apps.wallet.services.adjust import adjust_points


class TokenWalletAccountForm(forms.ModelForm):
    # A change, not a new total: added to (or taken from) whatever the balance is at that moment,
    # and written to the player's points history.
    adjust_by = forms.IntegerField(
        required=False,
        label=_("تغییر موجودی (+/−)"),
        help_text=_("مثلاً 100 برای افزودن یا -50 برای کسر. در تاریخچهٔ امتیاز کاربر ثبت می‌شود."),
    )

    class Meta:
        model = TokenWalletAccount
        fields = "__all__"
        help_texts = {
            "amount": _("موجودیِ امتیازِ این کاربر در این کیف (فقط خواندنی؛ با «تغییر موجودی» عوض می‌شود)."),
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
    readonly_fields = ("amount",)
    list_filter = ("token", "status")
    search_fields = ("wallet__user__phone_number", "token__symbol", "name")
    actions = ("add_100", "add_1000", "subtract_100")

    fieldsets = (
        (
            _("کیفِ امتیازِ کاربر"),
            {
                "description": _(
                    "<b>کم/زیادِ امتیاز اینجا انجام می‌شود.</b> عدد را در «تغییر موجودی» بنویس (مثبت یا منفی) "
                    "و ذخیره کن، یا در فهرست ردیف‌ها را انتخاب کن و از منوی «Action» استفاده کن. هر تغییر "
                    "به موجودیِ همان لحظه اضافه می‌شود و در تاریخچهٔ امتیاز کاربر ثبت می‌شود."
                ),
                "fields": ("name", "wallet", "preset_wallet", "token", "amount", "adjust_by", "status"),
            },
        ),
    )

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        delta = form.cleaned_data.get("adjust_by")
        if delta:
            adjust_points(obj, delta, request.user)

    def _adjust(self, request, queryset, delta):
        updated = 0
        for account in queryset:
            adjust_points(account, delta, request.user)
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
