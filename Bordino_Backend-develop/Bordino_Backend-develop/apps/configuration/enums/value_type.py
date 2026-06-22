from django.db import models
from django.utils.translation import gettext_lazy as _


class SystemConfigValueType(models.TextChoices):
    STR = "str", _("String")
    INT = "int", _("Integer")
    FLOAT = "float", _("Float")
    BOOL = "bool", _("Boolean")
    JSON = "json", _("JSON")
    LIST = "list", _("List (comma-separated)")
