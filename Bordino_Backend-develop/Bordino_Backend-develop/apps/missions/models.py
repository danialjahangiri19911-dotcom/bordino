"""«دریافت امتیاز»: missions a player does to earn points.

A mission is made in the admin panel (a video, a banner, signing up with a partner, installing an
app, scanning a QR at a place). Each try of a player is a MissionAttempt; the points are paid once
per completed attempt, through an ActivityTransaction (services.py).
"""

import secrets
import uuid
from pathlib import Path

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.files.storage import FileSystemStorage
from django.core.validators import MinValueValidator
from django.db import models
from django.utils.functional import cached_property
from django.utils.translation import gettext_lazy as _

from apps.django_helper.models.base import AbstractBaseModel

# Proof screenshots can show a player's personal details: kept outside the public /media files
# (the web server refuses /media/private/), shown to staff through the admin only.
class PrivateStorage(FileSystemStorage):
    """MEDIA_ROOT/private, read when used (so it follows MEDIA_ROOT, also in tests); no public URL."""

    @cached_property
    def base_location(self):
        return str(Path(settings.MEDIA_ROOT) / "private")

    def url(self, name):
        raise ValueError("Private files have no public address.")


def private_storage():
    return PrivateStorage()


def proof_path(instance, filename):
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    return f"mission-proofs/{uuid.uuid4().hex}.{ext if ext in ('jpg', 'png', 'webp') else 'jpg'}"


def new_qr_token():
    return secrets.token_urlsafe(18)


def new_callback_secret():
    return secrets.token_urlsafe(24)


class MissionCategory(AbstractBaseModel):
    name = models.CharField(max_length=60, verbose_name=_("نام"))
    icon = models.CharField(
        max_length=40,
        default="sparkles",
        verbose_name=_("آیکون"),
        help_text=_("نام آیکون اپ، مثلاً sparkles، play، smartphone، qr-code، user-plus، mouse-pointer-click."),
    )
    order = models.PositiveSmallIntegerField(default=0, verbose_name=_("ترتیب"))
    is_active = models.BooleanField(default=True, verbose_name=_("نمایش"))

    class Meta(AbstractBaseModel.Meta):
        verbose_name = _("دستهٔ مأموریت")
        verbose_name_plural = _("دسته‌های مأموریت")
        ordering = ("order", "name")

    def __str__(self):
        return self.name


class Mission(AbstractBaseModel):
    class Kind(models.TextChoices):
        VIDEO = "video", _("تماشای ویدیو")
        BANNER = "banner", _("کلیک روی بنر")
        SIGNUP = "signup", _("ثبت‌نام در سایت یا اپ همکار")
        INSTALL = "install", _("نصب اپلیکیشن")
        QR = "qr", _("حضور در محل و اسکن QR")

    class Verification(models.TextChoices):
        AUTO = "auto", _("خودکار")
        REVIEW = "review", _("بررسی مدرک توسط ادمین")
        CALLBACK = "callback", _("تأیید خودکار سرور همکار")

    class Repeat(models.TextChoices):
        ONCE = "once", _("یک بار")
        DAILY = "daily", _("روزانه")

    title = models.CharField(max_length=120, verbose_name=_("عنوان"))
    summary = models.CharField(max_length=200, blank=True, verbose_name=_("توضیح کوتاه"))
    description = models.TextField(blank=True, verbose_name=_("شرح و مراحل"))
    category = models.ForeignKey(
        MissionCategory, on_delete=models.PROTECT, related_name="missions", verbose_name=_("دسته")
    )
    kind = models.CharField(max_length=10, choices=Kind.choices, verbose_name=_("نوع"))
    verification = models.CharField(
        max_length=10,
        choices=Verification.choices,
        default=Verification.AUTO,
        verbose_name=_("روش تأیید"),
        help_text=_("ویدیو، بنر و QR: خودکار. ثبت‌نام و نصب اپ: بررسی مدرک یا تأیید سرور همکار."),
    )
    points = models.PositiveIntegerField(validators=[MinValueValidator(1)], verbose_name=_("امتیاز"))
    repeat = models.CharField(max_length=10, choices=Repeat.choices, default=Repeat.ONCE, verbose_name=_("تکرار"))
    daily_limit = models.PositiveSmallIntegerField(
        default=1,
        validators=[MinValueValidator(1)],
        verbose_name=_("دفعات در روز"),
        help_text=_("فقط برای مأموریت روزانه."),
    )
    link_url = models.URLField(
        max_length=500,
        blank=True,
        verbose_name=_("لینک"),
        help_text=_(
            "لینک بنر، سایت یا اپ همکار. برای تأیید سرور همکار {click_id} را در لینک بگذارید، "
            "مثلاً https://partner.ir/?ref=bordino&click_id={click_id}"
        ),
    )
    partner_name = models.CharField(max_length=80, blank=True, verbose_name=_("نام همکار"))
    image = models.ImageField(upload_to="missions/", blank=True, verbose_name=_("تصویر یا لوگو"))
    min_seconds = models.PositiveSmallIntegerField(
        default=10,
        verbose_name=_("ثانیه تا دریافت (بنر)"),
        help_text=_("بعد از باز کردن لینک بنر، چند ثانیه بعد امتیاز قابل دریافت است."),
    )
    proof_label = models.CharField(
        max_length=120,
        blank=True,
        verbose_name=_("متن مدرک"),
        help_text=_("برای بررسی مدرک: چه چیزی بنویسد، مثلاً «شماره موبایلی که با آن ثبت‌نام کردی». خالی = متن نمی‌خواهد."),
    )
    proof_image_required = models.BooleanField(
        default=False, verbose_name=_("اسکرین‌شات لازم است")
    )
    starts_at = models.DateTimeField(null=True, blank=True, verbose_name=_("شروع"))
    ends_at = models.DateTimeField(null=True, blank=True, verbose_name=_("پایان"))
    capacity = models.PositiveIntegerField(
        null=True, blank=True, verbose_name=_("ظرفیت کل"), help_text=_("خالی = بدون سقف.")
    )
    is_active = models.BooleanField(
        default=True, verbose_name=_("فعال"), help_text=_("غیرفعال: در فهرست با برچسب «غیرفعال» دیده می‌شود.")
    )
    is_visible = models.BooleanField(
        default=True, verbose_name=_("نمایش در فهرست"), help_text=_("خاموش: در فهرست دیده نمی‌شود (QR آن کار می‌کند).")
    )
    order = models.PositiveSmallIntegerField(
        default=0, verbose_name=_("ترتیب پیشنهادی"), help_text=_("عدد کمتر = بالاتر در «پیشنهادی».")
    )
    qr_token = models.CharField(max_length=40, unique=True, null=True, blank=True, editable=False)
    callback_secret = models.CharField(max_length=64, blank=True, editable=False)

    class Meta(AbstractBaseModel.Meta):
        verbose_name = _("مأموریت")
        verbose_name_plural = _("مأموریت‌ها")
        ordering = ("order", "-create_time")

    def __str__(self):
        return self.title

    def clean(self):
        super().clean()
        errors = {}
        auto_only = (self.Kind.VIDEO, self.Kind.BANNER, self.Kind.QR)
        if self.kind in auto_only and self.verification != self.Verification.AUTO:
            errors["verification"] = _("ویدیو، بنر و QR فقط تأیید خودکار دارند.")
        if self.kind in (self.Kind.SIGNUP, self.Kind.INSTALL) and self.verification == self.Verification.AUTO:
            errors["verification"] = _("ثبت‌نام و نصب اپ: بررسی مدرک یا تأیید سرور همکار.")
        if self.kind in (self.Kind.BANNER, self.Kind.SIGNUP, self.Kind.INSTALL) and not self.link_url:
            errors["link_url"] = _("این نوع مأموریت لینک لازم دارد.")
        if self.verification == self.Verification.CALLBACK and "{click_id}" not in (self.link_url or ""):
            errors["link_url"] = _("برای تأیید سرور همکار، {click_id} باید در لینک باشد.")
        if self.starts_at and self.ends_at and self.ends_at <= self.starts_at:
            errors["ends_at"] = _("پایان باید بعد از شروع باشد.")
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        if self.kind == self.Kind.QR and not self.qr_token:
            self.qr_token = new_qr_token()
        if self.verification == self.Verification.CALLBACK and not self.callback_secret:
            self.callback_secret = new_callback_secret()
        return super().save(*args, **kwargs)


class MissionAttempt(AbstractBaseModel):
    """One try of one player at one mission."""

    class Status(models.TextChoices):
        STARTED = "started", _("شروع شده")
        PENDING = "pending", _("در انتظار بررسی")
        COMPLETED = "completed", _("انجام شد")
        REJECTED = "rejected", _("رد شد")

    customer = models.ForeignKey("users.Customer", on_delete=models.PROTECT, related_name="mission_attempts")
    mission = models.ForeignKey(Mission, on_delete=models.PROTECT, related_name="attempts", verbose_name=_("مأموریت"))
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.STARTED, verbose_name=_("وضعیت"))
    # Copied when the try starts: a later change of the mission's points applies to new tries.
    points = models.PositiveIntegerField(verbose_name=_("امتیاز"))
    # The (Tehran) day the try was sent for review or completed: what the daily limit counts.
    day = models.DateField(null=True, blank=True, db_index=True)
    # Sent to the partner in the link; its server names it when it confirms the player.
    click_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    ad_session = models.OneToOneField(
        "wallet.AdRewardSession", on_delete=models.PROTECT, null=True, blank=True, related_name="mission_attempt"
    )
    proof_text = models.CharField(max_length=200, blank=True, verbose_name=_("متن مدرک"))
    proof_image = models.FileField(
        storage=private_storage, upload_to=proof_path, blank=True, verbose_name=_("اسکرین‌شات")
    )
    submitted_at = models.DateTimeField(null=True, blank=True, verbose_name=_("زمان ارسال مدرک"))
    review_note = models.CharField(
        max_length=300, blank=True, verbose_name=_("پیام بررسی"), help_text=_("دلیل رد، که بازیکن می‌بیند.")
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    completed_at = models.DateTimeField(null=True, blank=True, verbose_name=_("زمان انجام"))
    activity_transaction = models.OneToOneField(
        "wallet.ActivityTransaction", on_delete=models.PROTECT, null=True, blank=True, related_name="mission_attempt"
    )

    class Meta(AbstractBaseModel.Meta):
        verbose_name = _("انجام مأموریت")
        verbose_name_plural = _("انجام مأموریت‌ها")
        indexes = [
            models.Index(fields=["customer", "mission", "status"], name="mission_attempt_player"),
            models.Index(fields=["status", "submitted_at"], name="mission_attempt_review"),
        ]

    def __str__(self):
        return f"{self.mission} — {self.customer} ({self.get_status_display()})"
