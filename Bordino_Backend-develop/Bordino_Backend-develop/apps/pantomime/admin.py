from django.contrib import admin, messages
from django.db.models import Count, Q

from apps.pantomime.models import PantomimeCard, PantomimeCategory, PantomimeGame, PantomimeSettings


@admin.register(PantomimeSettings)
class PantomimeSettingsAdmin(admin.ModelAdmin):
    list_display = ("__str__", "enabled", "max_rounds", "max_teams", "max_members")
    fieldsets = (
        (None, {"fields": ("enabled",)}),
        ("زمان", {"fields": ("min_turn_seconds", "max_turn_seconds", "min_challenge_seconds", "max_challenge_seconds")}),
        ("تیم‌ها و دورها", {"fields": ("max_rounds", "max_teams", "max_members")}),
    )

    # One row: the game reads the first.
    def has_add_permission(self, request):
        return super().has_add_permission(request) and not PantomimeSettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False


class CardInline(admin.TabularInline):
    model = PantomimeCard
    fields = ("text", "difficulty", "is_active")
    extra = 1
    ordering = ("difficulty", "text")


@admin.register(PantomimeCategory)
class PantomimeCategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "icon", "weight", "order", "is_active", "active_cards")
    list_editable = ("order", "is_active")
    search_fields = ("name", "slug")
    inlines = (CardInline,)

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(n=Count("cards", filter=Q(cards__is_active=True)))

    @admin.display(description="کارت فعال", ordering="n")
    def active_cards(self, obj):
        return obj.n


@admin.register(PantomimeCard)
class PantomimeCardAdmin(admin.ModelAdmin):
    list_display = ("text", "category", "difficulty", "is_active")
    list_filter = ("category", "difficulty", "is_active")
    list_editable = ("is_active",)
    search_fields = ("text",)
    actions = ("activate", "deactivate")

    @admin.action(description="فعال کردن کارت‌های انتخاب‌شده", permissions=["change"])
    def activate(self, request, queryset):
        self.message_user(request, f"{queryset.update(is_active=True)} کارت فعال شد.", messages.SUCCESS)

    @admin.action(description="غیرفعال کردن کارت‌های انتخاب‌شده", permissions=["change"])
    def deactivate(self, request, queryset):
        self.message_user(request, f"{queryset.update(is_active=False)} کارت غیرفعال شد.", messages.SUCCESS)


@admin.register(PantomimeGame)
class PantomimeGameAdmin(admin.ModelAdmin):
    """The players' own records of finished games: read only."""

    list_display = ("create_time", "customer", "format", "mode", "rounds", "team_count", "winners")
    list_filter = ("format", "mode")
    search_fields = ("customer__user__phone_number", "winners")
    list_select_related = ("customer__user",)
    readonly_fields = ("customer", "format", "mode", "rounds", "team_count", "winners", "teams", "turns", "create_time")
    exclude = ("request_id",)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
