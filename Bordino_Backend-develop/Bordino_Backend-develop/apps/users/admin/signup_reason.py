from django.contrib.admin import register

from apps.django_helper.admin.base import BaseAdmin
from apps.users.models.signup_reason import SignupReason


@register(SignupReason)
class SignupReasonAdmin(BaseAdmin):
    allow_import = True  # plain reference data, no money
    list_display = (
        "id",
        "reason",
    )
