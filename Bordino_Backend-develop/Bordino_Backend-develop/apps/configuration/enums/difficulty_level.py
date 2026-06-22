from django.db import models
from django.utils.translation import gettext_lazy as _


class DifficultyLevel(models.TextChoices):
    EASY = "easy", _("Easy")
    MEDIUM = "medium", _("Medium")
    HARD = "hard", _("Hard")
