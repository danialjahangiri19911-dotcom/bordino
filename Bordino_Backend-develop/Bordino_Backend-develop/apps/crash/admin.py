from django.contrib import admin

from apps.crash.models import ChickenConfiguration, ChickenRound, CrashConfiguration, CrashRound


@admin.register(CrashConfiguration)
class CrashConfigurationAdmin(admin.ModelAdmin):
    list_display = ("enabled", "min_bet", "max_bet", "max_payout", "house_edge", "max_multiplier")

    def has_add_permission(self, request):
        return not CrashConfiguration.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(CrashRound)
class CrashRoundAdmin(admin.ModelAdmin):
    list_display = (
        "create_time",
        "customer",
        "bet",
        "auto_cashout",
        "crash_point",
        "cashout_multiplier",
        "payout",
        "status",
    )
    list_filter = ("status",)
    search_fields = ("customer__user__phone_number",)
    ordering = ("-create_time",)
    list_select_related = ("customer__user",)
    raw_id_fields = ("customer", "token_account")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(ChickenConfiguration)
class ChickenConfigurationAdmin(admin.ModelAdmin):
    list_display = ("enabled", "min_bet", "max_bet", "max_payout", "house_edge")

    def has_add_permission(self, request):
        return not ChickenConfiguration.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(ChickenRound)
class ChickenRoundAdmin(admin.ModelAdmin):
    list_display = (
        "create_time",
        "customer",
        "bet",
        "difficulty",
        "step",
        "hit_lane",
        "cashout_multiplier",
        "payout",
        "status",
    )
    list_filter = ("status", "difficulty")
    search_fields = ("customer__user__phone_number",)
    ordering = ("-create_time",)
    list_select_related = ("customer__user",)
    raw_id_fields = ("customer", "token_account")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
