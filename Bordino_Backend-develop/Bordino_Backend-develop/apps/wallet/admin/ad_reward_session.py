from django.contrib.admin import register

from apps.django_helper.admin.base import BaseAdmin
from apps.wallet.models import AdRewardSession


@register(AdRewardSession)
class AdRewardSessionAdmin(BaseAdmin):
    """Rewarded-ad views, for reports. Read-only: rewards are paid by the service, never by hand
    (the reward amount and daily limit are the AD_REWARD_* system configurations)."""

    list_display = ("id", "customer", "provider", "placement", "reward_points", "status", "create_time", "completed_at")
    list_filter = ("status", "provider", "placement")
    search_fields = ("customer__user__phone_number",)
    readonly_fields = tuple(f.name for f in AdRewardSession._meta.fields)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
