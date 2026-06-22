from django.contrib.admin import register

from apps.django_helper.admin.base import BaseAdmin
from apps.users.models.signup_reason import SignupReason


@register(SignupReason)
class SignupReasonAdmin(BaseAdmin):
    list_display = (
        "id",
        "reason",
    )
