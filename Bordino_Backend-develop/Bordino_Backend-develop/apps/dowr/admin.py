from django.contrib import admin

from apps.dowr.models import DowrCard, DowrCategory, DowrGame, DowrSettings


@admin.register(DowrSettings)
class DowrSettingsAdmin(admin.ModelAdmin):
    list_display = ("__str__", "enabled", "bomb_allowed", "max_rounds", "max_seconds")

    def has_add_permission(self, request):
        return not DowrSettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False


class DowrCardInline(admin.TabularInline):
    model = DowrCard
    extra = 1
    fields = ("text", "forbidden", "difficulty", "is_active")


@admin.register(DowrCategory)
class DowrCategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "icon", "order", "is_active", "card_count")
    list_editable = ("order", "is_active")
    inlines = (DowrCardInline,)

    @admin.display(description="کارت‌ها")
    def card_count(self, obj):
        return obj.cards.filter(is_active=True).count()


@admin.register(DowrCard)
class DowrCardAdmin(admin.ModelAdmin):
    list_display = ("text", "forbidden", "category", "difficulty", "is_active")
    list_filter = ("category", "difficulty", "is_active")
    search_fields = ("text", "forbidden")


@admin.register(DowrGame)
class DowrGameAdmin(admin.ModelAdmin):
    list_display = ("create_time", "customer", "mode", "rounds", "team_count", "winners")
    list_filter = ("mode",)
    search_fields = ("customer__user__phone_number", "winners")
    readonly_fields = ("customer", "request_id", "mode", "rounds", "seconds", "team_count", "bomb", "winners", "teams", "log")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
