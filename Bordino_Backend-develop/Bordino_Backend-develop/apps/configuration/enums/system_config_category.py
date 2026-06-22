from django.db import models
from django.utils.translation import gettext_lazy as _


class SystemConfigCategory(models.TextChoices):
    WALLET = "wallet", _("Wallet")
    FILE_UPLOAD = "file_upload", _("File Upload")
    API = "api", _("API")
