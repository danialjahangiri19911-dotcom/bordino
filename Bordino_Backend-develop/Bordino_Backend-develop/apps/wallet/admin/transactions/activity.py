from django.contrib import admin

from apps.wallet.models.transactions.activity import ActivityTransaction


@admin.register(ActivityTransaction)
class ActivityTransactionAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "customer",
        "section",
        "action_type",
        "score_value",
        "status",
        "create_time",
    )
    list_filter = (
        "section",
        "status",
        "create_time",
    )
    search_fields = (
        "customer__user__phone_number",
        "customer__user__username",
        "section",
        "action_type",
    )
    readonly_fields = ("create_time", "update_time")
    fieldsets = (
        (
            "Basic Information",
            {
                "fields": (
                    "customer",
                    "section",
                    "action_type",
                    "status",
                ),
            },
        ),
        (
            "Score & Reward",
            {
                "fields": ("score_value", "reward_data"),
            },
        ),
        (
            "Additional Data",
            {
                "fields": ("description", "metadata"),
            },
        ),
        (
            "Timestamps",
            {
                "fields": ("create_time", "update_time"),
            },
        ),
    )
