from django.contrib.admin import register

from apps.django_helper.admin.base import BaseAdmin
from apps.wallet.admin.safe_save import save_changed_fields
from apps.wallet.models.currency_wallet_account import CurrencyWalletAccount
from apps.wallet.admin.safe_save import LockedOwnershipAdmin


@register(CurrencyWalletAccount)
class CurrencyWalletAccountAdmin(LockedOwnershipAdmin, BaseAdmin):
    locked_on_change = ('wallet', 'preset_wallet')
    list_display = (
        "id",
        "name",
        "preset_wallet",
        "wallet",
        "balance",
        "status",
        "primary",
    )
    # Cash moves only through transactions (withdrawals, prizes): an edited balance would have no
    # history and could overwrite a payment made at the same moment.
    readonly_fields = ("balance",)

    def save_model(self, request, obj, form, change):
        if change:
            # Only the changed fields, never the balance (a full save would write back the balance as
            # it was when the page loaded, undoing a withdrawal or a prize made meanwhile).
            save_changed_fields(obj, form, protected={"balance"})
        else:
            super().save_model(request, obj, form, change)
