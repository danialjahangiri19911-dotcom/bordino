import json

from django.core.exceptions import ValidationError
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.configuration.enums import SystemConfigCategory, SystemConfigValueType
from apps.configuration.models.system_configuration_manager import SystemConfigurationManager
from apps.django_helper.models.base import AbstractBaseModel


class SystemConfiguration(AbstractBaseModel):
    key = models.CharField(max_length=255, unique=True)
    value = models.TextField(blank=True, null=True)
    default_value = models.TextField(blank=True, null=True)
    category = models.CharField(
        max_length=50,
        choices=SystemConfigCategory.choices,
        blank=True,
        null=True,
    )
    description = models.TextField(blank=True)
    value_type = models.CharField(
        max_length=20,
        choices=SystemConfigValueType.choices,
        default=SystemConfigValueType.STR,
    )

    objects = SystemConfigurationManager()

    def clean(self):
        super().clean()
        if self.key:
            self.key = self.key.strip()
        if not self.key:
            raise ValidationError({"key": _("Key cannot be empty.")})

    def __str__(self):
        return self.key

    def get_typed_value(self, raw: str | None):
        if raw is None or raw == "":
            return None
        raw = raw.strip()
        if self.value_type == SystemConfigValueType.INT:
            try:
                return int(raw)
            except ValueError:
                return None
        if self.value_type == SystemConfigValueType.BOOL:
            return raw.lower() in ("true", "1", "yes", "on")
        if self.value_type == SystemConfigValueType.JSON:
            try:
                return json.loads(raw)
            except json.JSONDecodeError:
                return raw
        if self.value_type == SystemConfigValueType.LIST:
            return [x.strip() for x in raw.split(",") if x.strip()]
        return raw
