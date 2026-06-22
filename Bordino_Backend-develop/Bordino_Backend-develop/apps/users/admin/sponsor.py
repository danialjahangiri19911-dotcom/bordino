from django.contrib.admin import register

from apps.django_helper.admin.base import BaseAdmin
from apps.users.models.sponsor import Sponsor


@register(Sponsor)
class SponsorAdmin(BaseAdmin):
    search_fields = ("user__phone_number", "user__username")
    autocomplete_fields = ("user",)
    list_display = (
        "id",
        "user",
    )
