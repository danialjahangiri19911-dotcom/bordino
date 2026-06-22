from django.contrib.admin import register

from apps.django_helper.admin.base import BaseAdmin
from apps.wallet.models.currency import Currency


@register(Currency)
class CurrencyAdmin(BaseAdmin):
    list_display = (
        "id",
        "symbol",
        "name",
    )
