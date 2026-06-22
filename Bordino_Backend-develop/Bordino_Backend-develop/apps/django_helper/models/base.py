from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.django_helper.models.id_only import AbstractIDOnlyModel


class AbstractBaseModel(AbstractIDOnlyModel):
    create_time = models.DateTimeField(_("Create Time"), auto_now_add=True)
    update_time = models.DateTimeField(_("Update Time"), auto_now=True)

    auto_cols = ["create_time", "update_time"]

    class Meta(AbstractIDOnlyModel.Meta):
        abstract = True
        ordering = ("-create_time",)
        get_latest_by = ("create_time",)

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)
