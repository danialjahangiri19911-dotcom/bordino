from django.contrib import admin

from apps.django_helper.admin.base import BaseAdmin
from apps.lottery.models import ReferralRewardConfig


@admin.register(ReferralRewardConfig)
class ReferralRewardConfigAdmin(BaseAdmin):
    list_display = ("level", "token_percentage", "is_active")
    list_filter = ("is_active",)
    search_fields = ("level",)
    list_editable = ("is_active",)
    list_per_page = 10
    ordering = ("level",)
