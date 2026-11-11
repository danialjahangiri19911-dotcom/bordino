from django.contrib import admin

from apps.coins.models import CoinPackage, CoinPurchase


@admin.register(CoinPackage)
class CoinPackageAdmin(admin.ModelAdmin):
    list_display = ("coins", "price_toman", "original_price_toman", "badge", "is_active", "sort_order")
    list_editable = ("is_active", "sort_order")
    ordering = ("sort_order", "price_toman")


@admin.register(CoinPurchase)
class CoinPurchaseAdmin(admin.ModelAdmin):
    """Read-only: a purchase changes only through the payment's confirmation (which credits once)."""

    list_display = ("create_time", "customer", "coins", "amount_toman", "status", "mode", "ref_number")
    list_filter = ("status", "mode")
    search_fields = ("track_id", "ref_number", "customer__user__phone_number")
    readonly_fields = [f.name for f in CoinPurchase._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
