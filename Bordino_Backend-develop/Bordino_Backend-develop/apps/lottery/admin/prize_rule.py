from django.contrib import admin
from django.contrib.admin import register
from django.utils.translation import gettext as _

from apps.django_helper.admin.base import BaseAdmin
from apps.lottery.models import PrizeRule


class PrizeRuleInline(admin.TabularInline):
    model = PrizeRule
    extra = 1


@register(PrizeRule)
class PrizeRuleAdmin(BaseAdmin):
    list_display = (
        "id",
        "lottery",
        "match_count",
        "prize_amount",
    )

    def get_list_display(self, request):
        return self.list_display

    def get_fieldsets(self, request, obj=None):
        fieldsets = super().get_fieldsets(request, obj)
        fieldsets = tuple(fs for fs in fieldsets if fs[0] != _("Other Data"))
        return fieldsets

    def get_readonly_fields(self, request, obj=None):
        readonly_fields = super().get_readonly_fields(request, obj)
        return tuple(f for f in readonly_fields if f not in ("create_time", "update_time"))
