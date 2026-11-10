from django.contrib.admin import register

from apps.django_helper.admin.base import BaseAdmin
from apps.wallet.models import AdiveryCallbackAttempt


@register(AdiveryCallbackAttempt)
class AdiveryCallbackAttemptAdmin(BaseAdmin):
    """Every call to the Adivery reward-confirmation address (read-only; kept 90 days). An empty list
    means Adivery has not called; «کلید آدرس درست بود» = no means someone else (or a wrong address)."""

    list_display = ("create_time", "method", "http_status", "outcome", "secret_ok", "session_ref", "message", "ip")
    list_filter = ("outcome", "secret_ok", "method", "http_status")
    search_fields = ("session_ref", "ip", "message")
    readonly_fields = tuple(f.name for f in AdiveryCallbackAttempt._meta.fields)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
