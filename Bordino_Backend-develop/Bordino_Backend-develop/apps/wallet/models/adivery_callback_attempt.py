from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.django_helper.models.base import AbstractBaseModel


class AdiveryCallbackAttempt(AbstractBaseModel):
    """Every call that reached the Adivery reward-confirmation address, whatever it said: who called,
    what it sent (parameter names and values, never the address's secret) and how it was answered.
    Kept 90 days, so «has Adivery ever called, and with what?» has an answer after any deploy."""

    class Outcome(models.TextChoices):
        PAID = "paid", _("پرداخت شد")
        ALREADY = "already", _("قبلاً پرداخت شده")
        NOT_PAID = "not_paid", _("تأیید شد، پرداخت نشد")
        REFUSED = "refused", _("رد شد")
        ERROR = "error", _("خطای سرور")

    method = models.CharField(max_length=8, verbose_name=_("روش"))
    ip = models.CharField(max_length=64, blank=True, verbose_name=_("IP فرستنده"))
    secret_ok = models.BooleanField(default=False, verbose_name=_("کلید آدرس درست بود"))
    params = models.JSONField(default=dict, blank=True, verbose_name=_("پارامترهای دریافتی"))
    session_ref = models.CharField(max_length=100, blank=True, verbose_name=_("uid (شناسهٔ تماشا)"))
    outcome = models.CharField(max_length=10, choices=Outcome.choices, verbose_name=_("نتیجه"))
    http_status = models.PositiveSmallIntegerField(verbose_name=_("کد پاسخ"))
    message = models.CharField(max_length=200, blank=True, verbose_name=_("پیام"))

    class Meta(AbstractBaseModel.Meta):
        verbose_name = _("تماس ادیوری (تأیید جایزه)")
        verbose_name_plural = _("تماس‌های ادیوری (تأیید جایزه)")
        ordering = ("-create_time",)
        indexes = [models.Index(fields=["-create_time"], name="adivery_attempt_recent")]

    def __str__(self):
        return f"{self.method} {self.http_status} {self.outcome}"
