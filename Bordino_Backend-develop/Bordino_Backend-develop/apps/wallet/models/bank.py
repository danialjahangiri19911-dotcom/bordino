from django.db import models

from apps.django_helper.models.base import AbstractBaseModel


class Bank(AbstractBaseModel):
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=20, unique=True, null=True, blank=True)
    icon = models.ForeignKey(
        "users.File",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="banks",
    )
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name
