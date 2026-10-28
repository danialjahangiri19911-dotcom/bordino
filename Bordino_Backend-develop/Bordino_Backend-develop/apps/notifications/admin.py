from django.contrib.admin import register

from apps.django_helper.admin.base import BaseAdmin
from apps.notifications.models import AppDevice, NotificationLog, NotificationPreference, PushSubscription


@register(NotificationPreference)
class NotificationPreferenceAdmin(BaseAdmin):
    list_display = ("customer", "lottery", "account", "games", "update_time")
    list_filter = ("lottery", "account", "games")
    search_fields = ("customer__user__phone_number",)


@register(PushSubscription)
class PushSubscriptionAdmin(BaseAdmin):
    list_display = ("customer", "user_agent", "create_time", "last_sent_at")
    search_fields = ("customer__user__phone_number",)
    readonly_fields = ("customer", "endpoint", "p256dh", "auth", "user_agent", "last_sent_at")


@register(AppDevice)
class AppDeviceAdmin(BaseAdmin):
    list_display = ("customer", "provider", "device_id", "create_time", "last_sent_at")
    list_filter = ("provider",)
    search_fields = ("customer__user__phone_number", "device_id")


@register(NotificationLog)
class NotificationLogAdmin(BaseAdmin):
    list_display = ("customer", "category", "title", "delivered", "create_time")
    list_filter = ("category",)
    search_fields = ("customer__user__phone_number", "title", "key")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
