from django.contrib.admin import register

from apps.django_helper.admin.base import BaseAdmin
from apps.users.models.dailyusage import DailyUsage


@register(DailyUsage)
class DailyUsageAdmin(BaseAdmin):
    search_fields = ("usage_duration_per_day",)
    list_display = (
        "id",
        "usage_duration_per_day",
        "reward_points",
    )
