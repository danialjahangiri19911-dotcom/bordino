from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.django_helper.models.base import AbstractBaseModel
from apps.users.models.file import File


class Category(AbstractBaseModel):
    class Meta(AbstractBaseModel.Meta):
        verbose_name = _("Category")
        verbose_name_plural = _("Categories")

    name = models.CharField(verbose_name=_("name"), max_length=20, unique=True)
    parent = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sub_categories",
        verbose_name=_("Parent Category"),
    )
    icon = models.ForeignKey(
        File,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name=_("Icon"),
        related_name="category_icons",
    )

    def __str__(self):
        return self.name
