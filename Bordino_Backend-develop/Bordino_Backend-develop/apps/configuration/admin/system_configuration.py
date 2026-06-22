from django.contrib import admin
from django.utils.html import format_html

from apps.configuration.models.system_configuration import SystemConfiguration


@admin.register(SystemConfiguration)
class SystemConfigurationAdmin(admin.ModelAdmin):
    list_display = (
        "key",
        "category",
        "display_value",
        "value_type",
        "create_time",
    )
    list_filter = ("category", "value_type")
    search_fields = ("key", "description")
    readonly_fields = ("create_time", "update_time")
    ordering = ("category", "key")
    fieldsets = (
        (
            "Key",
            {"fields": ("key", "category", "description")},
        ),
        (
            "Value",
            {
                "fields": ("value", "default_value", "value_type"),
                "description": "Value takes precedence over default_value. Do not store secret data; use environment variables for passwords and API keys.",
            },
        ),
        (
            "Timestamps",
            {"fields": ("create_time", "update_time")},
        ),
    )

    def display_value(self, obj):
        val = obj.value or obj.default_value or ""
        if len(val) > 50:
            return format_html("{}...", val[:50])
        return val

    display_value.short_description = "Value"
