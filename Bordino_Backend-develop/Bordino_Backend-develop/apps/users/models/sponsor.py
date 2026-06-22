from django.contrib.auth import get_user_model
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.django_helper.models.base import AbstractBaseModel

User = get_user_model()


class Sponsor(AbstractBaseModel):
    class Meta(AbstractBaseModel.Meta):
        verbose_name = _("Sponsor")
        verbose_name_plural = _("Sponsors")

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="sponsor")

    def __str__(self):
        return self.user.phone_number
