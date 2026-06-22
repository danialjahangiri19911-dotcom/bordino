from django.contrib.admin import register

from apps.django_helper.admin.base import BaseAdmin
from apps.entertainment.models import FortuneReading


@register(FortuneReading)
class FortuneReadingAdmin(BaseAdmin):
    list_display = (
        "id",
        "type",
        "create_time",
    )
    list_filter = (
        "type",
        "create_time",
    )
    search_fields = (
        "question",
        "result",
    )
    readonly_fields = ("create_time", "update_time")
