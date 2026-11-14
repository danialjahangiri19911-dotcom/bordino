"""Step-by-step traces of what a player's phone did in a flow the server cannot see (2026-11-14: the
profile photo — two attempts that never reached the server). The app reports each step of an attempt
(«attempt» groups them); the server adds its own steps for the same flow. Kept 30 days."""

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.django_helper.models.base import AbstractBaseModel


class ClientLog(AbstractBaseModel):
    class Level(models.TextChoices):
        INFO = "info", _("اطلاعات")
        ERROR = "error", _("خطا")

    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+", verbose_name=_("کاربر"))
    phone = models.CharField(max_length=20, blank=True, db_index=True, verbose_name=_("تلفن"))
    flow = models.CharField(max_length=40, db_index=True, verbose_name=_("بخش"))
    attempt = models.CharField(max_length=40, blank=True, db_index=True, verbose_name=_("تلاش"))
    step = models.CharField(max_length=60, verbose_name=_("مرحله"))
    level = models.CharField(max_length=8, choices=Level.choices, default=Level.INFO, verbose_name=_("سطح"))
    source = models.CharField(max_length=10, default="app", verbose_name=_("منبع"), help_text=_("app = گوشی، server = سرور"))
    data = models.JSONField(default=dict, blank=True, verbose_name=_("جزئیات"))
    user_agent = models.CharField(max_length=300, blank=True, verbose_name=_("مرورگر"))
    ip = models.GenericIPAddressField(null=True, blank=True)
    client_time = models.DateTimeField(null=True, blank=True, verbose_name=_("زمان در گوشی"))

    class Meta(AbstractBaseModel.Meta):
        verbose_name = _("لاگ برنامه")
        verbose_name_plural = _("لاگ‌های برنامه")
        indexes = [models.Index(fields=["phone", "-create_time"])]

    def __str__(self):
        return f"{self.phone} {self.flow}/{self.step}"
