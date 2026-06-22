from django.contrib.admin import register

from apps.django_helper.admin.base import BaseAdmin
from apps.wallet.models.token import Token


@register(Token)
class TokenAdmin(BaseAdmin):
    autocomplete_fields = ("owner", "logo")
    list_display = (
        "id",
        "name",
        "symbol",
        "owner",
        "price",
    )
