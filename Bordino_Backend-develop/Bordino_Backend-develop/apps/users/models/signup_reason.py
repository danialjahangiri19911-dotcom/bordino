from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.django_helper.models.base import AbstractBaseModel
from apps.users.models.file import File


class SignupReason(AbstractBaseModel):
    reason = models.CharField(max_length=25, unique=True, verbose_name=_("Reason"), null=True)
    icon = models.ForeignKey(
        File,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name=_("Icon"),
        related_name="signup_reason_icons",
    )

    class Meta(AbstractBaseModel.Meta):
        verbose_name = _("Signup Reason")
        verbose_name_plural = _("Signup Reasons")

    def __str__(self):
        return self.reason
