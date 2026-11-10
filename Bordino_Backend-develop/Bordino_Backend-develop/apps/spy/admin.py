from django.contrib import admin

from apps.spy.models import SpyCategory, SpySettings, SpyWord


@admin.register(SpySettings)
class SpySettingsAdmin(admin.ModelAdmin):
    list_display = ("__str__", "enabled", "adults_allowed")

    def has_add_permission(self, request):
        return not SpySettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False


class SpyWordInline(admin.TabularInline):
    model = SpyWord
    extra = 1
    fields = ("text", "related", "difficulty", "age", "is_active")


@admin.register(SpyCategory)
class SpyCategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "icon", "order", "is_active", "word_count")
    list_editable = ("order", "is_active")
    inlines = (SpyWordInline,)

    @admin.display(description="کلمه‌ها")
    def word_count(self, obj):
        return obj.words.filter(is_active=True).count()


@admin.register(SpyWord)
class SpyWordAdmin(admin.ModelAdmin):
    list_display = ("text", "related", "category", "difficulty", "age", "is_active")
    list_filter = ("category", "difficulty", "age", "is_active")
    search_fields = ("text", "related")
