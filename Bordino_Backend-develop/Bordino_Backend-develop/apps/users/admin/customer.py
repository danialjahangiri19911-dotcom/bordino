from django.contrib.admin import register
from django.utils.translation import gettext as _

from apps.django_helper.admin.base import BaseAdmin
from apps.users.models.customer import Customer


@register(Customer)
class CustomerAdmin(BaseAdmin):
    search_fields = ("user__phone_number", "user__username", "referral_code")
    autocomplete_fields = ("user", "invited_by", "image", "daily_usage_minutes")
    list_display = (
        "id",
        "user",
        "daily_usage_minutes",
        "display_favorite_categories",
        "display_signup_reasons",
    )

    def display_favorite_categories(self, obj):
        return ", ".join([category.name for category in obj.favorite_categories.all()])

    display_favorite_categories.short_description = _("Favorite Categories")  # type: ignore[attr-defined]

    def display_signup_reasons(self, obj):
        return ", ".join([reason.reason for reason in obj.signup_reasons.all()])

    display_signup_reasons.short_description = _("Signup Reasons")  # type: ignore[attr-defined]
