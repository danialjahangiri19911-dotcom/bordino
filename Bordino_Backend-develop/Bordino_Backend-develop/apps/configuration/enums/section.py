from django.db import models
from django.utils.translation import gettext_lazy as _


class Section(models.TextChoices):
    SUDOKU = "sudoku", _("Sudoku")
    GAME_2048 = "game_2048", _("Game 2048")
    WATCH_VIDEO = "watch_video", _("Watch Video")
    CLICK_AD = "click_ad", _("Click Ad")
    QUESTIONNAIRE = "questionnaire", _("Questionnaire")
    SIGNUP = "signup", _("Signup")
