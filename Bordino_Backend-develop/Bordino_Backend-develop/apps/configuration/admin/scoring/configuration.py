from django.contrib import admin

from apps.configuration.models.scoring import ScoreConfiguration


@admin.register(ScoreConfiguration)
class ScoreConfigurationAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "section",
        "action_type",
        "score_value",
        "is_active",
        "create_time",
    )
    list_filter = ("section", "is_active", "create_time")
    search_fields = ("section", "action_type")
    readonly_fields = ("create_time", "update_time")
    fieldsets = (
        (
            "Basic Information",
            {
                "fields": ("section", "action_type", "score_value", "is_active"),
            },
        ),
        (
            "Additional Data",
            {
                "fields": ("metadata",),
            },
        ),
        (
            "Timestamps",
            {
                "fields": ("create_time", "update_time"),
            },
        ),
    )
