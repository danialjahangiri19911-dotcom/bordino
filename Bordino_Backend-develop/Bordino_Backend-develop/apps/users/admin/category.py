from django.contrib.admin import register

from apps.django_helper.admin.base import BaseAdmin
from apps.users.models.category import Category


@register(Category)
class CategoryAdmin(BaseAdmin):
    allow_import = True  # plain reference data, no money
    search_fields = ("name",)
    autocomplete_fields = ("parent", "icon")
    list_display = (
        "id",
        "name",
    )
