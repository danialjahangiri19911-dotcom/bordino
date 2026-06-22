from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.django_helper.utils.validators import document_validator


class File(models.Model):
    class Meta:
        verbose_name = _("File")
        verbose_name_plural = _("Files")

    file = models.FileField(
        verbose_name=_("file"),
        upload_to="files/",
        validators=[document_validator],
    )
    uploaded_at = models.DateTimeField(
        verbose_name=_("uploaded at"),
        auto_now_add=True,
    )

    def __str__(self):
        return f"File: {self.file.name}"
