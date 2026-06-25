from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.configuration.enums import DifficultyLevel
from apps.django_helper.models.base import AbstractBaseModel


class GameConfiguration(AbstractBaseModel):
    game_name = models.CharField(max_length=100)
    difficulty_level = models.CharField(
        max_length=20,
        choices=DifficultyLevel.choices,
        null=True,
        blank=True,
    )
    timer = models.PositiveIntegerField(
        validators=[MinValueValidator(0)],
        null=True,
        blank=True,
    )
    max_errors = models.PositiveIntegerField(validators=[MinValueValidator(0)], default=3)
    hint_count = models.PositiveIntegerField(validators=[MinValueValidator(0)], default=1)
    daily_score_limit = models.PositiveIntegerField(validators=[MinValueValidator(0)], default=0)
    play_cost = models.PositiveIntegerField(
        validators=[MinValueValidator(0)],
        default=0,
        verbose_name=_("Play cost"),
        help_text=_(
            "امتیازی که با هر بار بازی (شروع/ادامه) از کیفِ امتیازِ کاربر کم می‌شود. "
            "۰ = رایگان."
        ),
    )
    is_active = models.BooleanField(default=True)

    class Meta(AbstractBaseModel.Meta):
        unique_together = [("game_name", "difficulty_level")]

    def clean(self):
        super().clean()
        if self.game_name:
            self.game_name = self.game_name.lower().strip()

        if not self.game_name:
            raise ValidationError({"game_name": _("Game name cannot be empty.")})

        if self.difficulty_level and self.difficulty_level not in [
            choice[0] for choice in DifficultyLevel.choices
        ]:
            raise ValidationError({"difficulty_level": _("Invalid difficulty level.")})

        if self.timer is not None and self.timer < 0:
            raise ValidationError({"timer": _("Timer cannot be negative.")})

        if self.max_errors < 0:
            raise ValidationError({"max_errors": _("Max errors cannot be negative.")})

        if self.hint_count < 0:
            raise ValidationError({"hint_count": _("Hint count cannot be negative.")})

        if self.daily_score_limit < 0:
            raise ValidationError({"daily_score_limit": _("Daily score limit cannot be negative.")})

    def __str__(self):
        if self.difficulty_level:
            return f"{self.game_name} - {self.get_difficulty_level_display()}"
        return self.game_name
