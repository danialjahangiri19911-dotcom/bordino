from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import Q
from django.utils.translation import gettext_lazy as _

from apps.configuration.enums import Section
from apps.django_helper.models.base import AbstractBaseModel


class ScoreConfiguration(AbstractBaseModel):
    section = models.CharField(max_length=50)
    action_type = models.CharField(max_length=100)
    score_value = models.IntegerField(
        verbose_name=_("Score Value"), validators=[MinValueValidator(0)]
    )
    is_active = models.BooleanField(default=True)

    metadata = models.JSONField(
        default=dict,
        blank=True,
        verbose_name=_("Metadata"),
        help_text=_("Additional configuration data in JSON format"),
    )

    content_type = models.ForeignKey(
        ContentType,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="score_configurations",
    )
    object_id = models.UUIDField(null=True, blank=True)
    content_object = GenericForeignKey("content_type", "object_id")

    class Meta(AbstractBaseModel.Meta):
        constraints = [
            models.UniqueConstraint(
                fields=("content_type", "object_id", "action_type"),
                condition=Q(content_type__isnull=False),
                name="unique_action_type_per_game_config",
            ),
            models.UniqueConstraint(
                fields=("section", "action_type"),
                condition=Q(content_type__isnull=True),
                name="unique_section_action_type_standalone",
            ),
        ]

    def clean(self):
        super().clean()

        if self.section:
            self.section = self.section.lower().strip()

        if not self.section:
            raise ValidationError({"section": _("Section cannot be empty.")})

        if self.action_type:
            self.action_type = self.action_type.strip()

        if not self.action_type:
            raise ValidationError({"action_type": _("Action type cannot be empty.")})

        if self.score_value < 0:
            raise ValidationError({"score_value": _("Score value cannot be negative.")})

        if self.metadata and not isinstance(self.metadata, dict):
            raise ValidationError({"metadata": _("Metadata must be a valid JSON object.")})

        if self.content_type_id and self.object_id and self.action_type:
            qs = ScoreConfiguration.objects.filter(
                content_type_id=self.content_type_id,
                object_id=self.object_id,
                action_type=self.action_type.strip(),
            )
            if self.pk:
                qs = qs.exclude(pk=self.pk)
            if qs.exists():
                raise ValidationError(
                    {
                        "action_type": _(
                            "This action type is already defined for this game configuration (same level)."
                        )
                    }
                )

    def __str__(self):
        return f"{self.section} - {self.action_type}: {self.score_value} points"

    def is_valid_at(self, at_time=None):
        return self.is_active
