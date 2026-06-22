from django.contrib import admin

from apps.configuration.admin.game.inline import ScoreConfigurationInline
from apps.configuration.models.game import GameConfiguration


@admin.register(GameConfiguration)
class GameConfigurationAdmin(admin.ModelAdmin):
    inlines = [ScoreConfigurationInline]

    def get_formsets_with_inlines(self, request, obj=None):
        for inline in self.get_inline_instances(request, obj):
            inline.parent_obj = obj
            yield inline.get_formset(request, obj), inline

    def save_formset(self, request, form, formset, change):
        instances = formset.save(commit=False)
        parent_obj = form.instance
        for instance in instances:
            instance.section = parent_obj.game_name
            instance.save()
        formset.save_m2m()
        for obj in formset.deleted_objects:
            obj.delete()

    list_display = (
        "id",
        "game_name",
        "difficulty_level",
        "timer",
        "max_errors",
        "hint_count",
        "daily_score_limit",
        "is_active",
        "create_time",
    )
    list_filter = ("game_name", "difficulty_level", "is_active", "create_time")
    search_fields = ("game_name",)
    readonly_fields = ("create_time", "update_time")
    fieldsets = (
        (
            "Basic Information",
            {
                "fields": ("game_name", "difficulty_level", "is_active"),
            },
        ),
        (
            "Game Settings",
            {
                "fields": ("timer", "max_errors", "hint_count", "daily_score_limit"),
            },
        ),
        (
            "Timestamps",
            {
                "fields": ("create_time", "update_time"),
            },
        ),
    )
