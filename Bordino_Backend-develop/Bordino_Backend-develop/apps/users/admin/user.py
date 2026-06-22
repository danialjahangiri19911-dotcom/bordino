from django.contrib.admin import register
from django.contrib.auth import get_user_model

from apps.django_helper.admin.base import BaseAdmin

User = get_user_model()


@register(User)
class CustomUserAdmin(BaseAdmin):
    search_fields = ("phone_number", "username")
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": (
                    "username",
                    "first_name",
                    "last_name",
                ),
            },
        ),
    )
