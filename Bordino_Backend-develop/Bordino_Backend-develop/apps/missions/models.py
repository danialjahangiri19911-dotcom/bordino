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
from django.db import models, transaction
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
        INTERSTITIAL = "interstitial", _("دیدن تبلیغ تمام‌صفحه")
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
    kind = models.CharField(max_length=20, choices=Kind.choices, verbose_name=_("نوع"))
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
        verbose_name=_("ثانیه تا دریافت (بنر، تبلیغ تمام‌صفحه)"),
        help_text=_("بعد از باز کردن لینک بنر یا نمایش تبلیغ تمام‌صفحه، چند ثانیه بعد امتیاز قابل دریافت است."),
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
    qr_rotating = models.BooleanField(
        default=False,
        verbose_name=_("QR متغیر روی نمایشگر محل"),
        help_text=_(
            "روشن: به‌جای QR چاپی، یک تبلت یا تلویزیون در محل لینک «نمایشگر» را باز می‌کند و هر ۳۰ ثانیه QR تازه "
            "نشان می‌دهد. عکسِ فرستاده‌شدهٔ QR بعد از ۲ دقیقه کار نمی‌کند و QR چاپی قبلی هم دیگر پذیرفته نمی‌شود."
        ),
    )
    # The venue screen's address (/venue/<key>): whoever has it can show the current code.
    qr_display_key = models.CharField(max_length=64, unique=True, null=True, blank=True, editable=False)
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
        auto_only = (self.Kind.VIDEO, self.Kind.BANNER, self.Kind.INTERSTITIAL, self.Kind.QR)
        if self.kind in auto_only and self.verification != self.Verification.AUTO:
            errors["verification"] = _("ویدیو، بنر، تبلیغ تمام‌صفحه و QR فقط تأیید خودکار دارند.")
        if self.kind in (self.Kind.SIGNUP, self.Kind.INSTALL) and self.verification == self.Verification.AUTO:
            errors["verification"] = _("ثبت‌نام و نصب اپ: بررسی مدرک یا تأیید سرور همکار.")
        if self.kind in (self.Kind.BANNER, self.Kind.SIGNUP, self.Kind.INSTALL) and not self.link_url:
            errors["link_url"] = _("این نوع مأموریت لینک لازم دارد.")
        if self.verification == self.Verification.CALLBACK and "{click_id}" not in (self.link_url or ""):
            errors["link_url"] = _("برای تأیید سرور همکار، {click_id} باید در لینک باشد.")
        if self.qr_rotating and self.kind != self.Kind.QR:
            errors["qr_rotating"] = _("QR متغیر فقط برای مأموریت QR است.")
        if self.starts_at and self.ends_at and self.ends_at <= self.starts_at:
            errors["ends_at"] = _("پایان باید بعد از شروع باشد.")
        if self.pk and self.attempts.exists():
            # Open tries were started under these rules: changing them would let a try skip its check.
            before = Mission.objects.filter(pk=self.pk).values("kind", "verification").first()
            if before and (before["kind"], before["verification"]) != (self.kind, self.verification):
                errors["kind"] = _("بعد از شروع بازیکنان، نوع و روش تأیید عوض نمی‌شود؛ مأموریت تازه بسازید.")
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        if self.kind == self.Kind.QR and not self.qr_token:
            self.qr_token = new_qr_token()
        if self.kind == self.Kind.QR and self.qr_rotating and not self.qr_display_key:
            self.qr_display_key = new_callback_secret()
        if self.verification == self.Verification.CALLBACK and not self.callback_secret:
            self.callback_secret = new_callback_secret()
        with transaction.atomic():
            if self.pk:
                # The same lock as a player's start: clean() sees every try started before this edit.
                Mission.objects.select_for_update().filter(pk=self.pk).first()
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
    # When the player opened the banner's link (its wait counts from here).
    opened_at = models.DateTimeField(null=True, blank=True, verbose_name=_("زمان باز کردن لینک"))
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


# ── «معمای شهری»: a chain of clues, each solved at a real place ──
# A mystery is a few steps (MysteryStep), each at a place (a café, a shop, a landmark). The player
# reads the clue, finds the place and proves they are there (its QR, the phone's location, an answer
# only found there, or a code the staff give); the place is then shown (name, logo, address, offer)
# and the next clue opens. Each step pays its points, the last one the finish bonus too. Every proof
# is a MysteryCheckin: the visits per place the admin's foot-traffic report counts.


def mystery_upload(instance, filename):
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    return f"mysteries/{uuid.uuid4().hex}.{ext if ext in ('jpg', 'jpeg', 'png', 'webp') else 'jpg'}"


class Mystery(AbstractBaseModel):
    title = models.CharField(max_length=120, verbose_name=_("عنوان"))
    summary = models.CharField(max_length=200, blank=True, verbose_name=_("توضیح کوتاه"))
    story = models.TextField(
        blank=True, verbose_name=_("داستان"), help_text=_("متن شروع معما که بازیکن قبل از اولین سرنخ می‌خواند.")
    )
    cover = models.ImageField(upload_to=mystery_upload, blank=True, verbose_name=_("تصویر"))
    area = models.CharField(
        max_length=120, blank=True, verbose_name=_("محدوده"), help_text=_("مثلاً «خیابان ولیعصر، از تجریش تا ونک».")
    )
    duration_minutes = models.PositiveSmallIntegerField(
        null=True, blank=True, verbose_name=_("زمان تقریبی (دقیقه)")
    )
    finish_points = models.PositiveIntegerField(
        default=0, verbose_name=_("جایزهٔ پایان"), help_text=_("امتیازی که با حل آخرین مرحله، جدا از امتیاز مرحله‌ها، می‌گیرد.")
    )
    starts_at = models.DateTimeField(null=True, blank=True, verbose_name=_("شروع"))
    ends_at = models.DateTimeField(
        null=True, blank=True, verbose_name=_("پایان"), help_text=_("بعد از آن هیچ مرحله‌ای پذیرفته نمی‌شود.")
    )
    capacity = models.PositiveIntegerField(
        null=True, blank=True, verbose_name=_("ظرفیت بازیکنان"), help_text=_("چند نفر می‌توانند شروع کنند. خالی = بدون سقف.")
    )
    is_active = models.BooleanField(default=True, verbose_name=_("فعال"))
    is_visible = models.BooleanField(
        default=True,
        verbose_name=_("نمایش در فهرست"),
        help_text=_("خاموش: در فهرست دیده نمی‌شود، ولی با اسکن QR مرحلهٔ اول شروع می‌شود (معمای فقط-پوستری)."),
    )
    order = models.PositiveSmallIntegerField(default=0, verbose_name=_("ترتیب"))

    class Meta(AbstractBaseModel.Meta):
        verbose_name = _("معمای شهری")
        verbose_name_plural = _("معماهای شهری")
        ordering = ("order", "-create_time")

    def __str__(self):
        return self.title

    def clean(self):
        super().clean()
        if self.starts_at and self.ends_at and self.ends_at <= self.starts_at:
            raise ValidationError({"ends_at": _("پایان باید بعد از شروع باشد.")})


class MysteryStep(AbstractBaseModel):
    class Proof(models.TextChoices):
        QR = "qr", _("اسکن QR محل")
        GPS = "gps", _("موقعیت گوشی (GPS)")
        ANSWER = "answer", _("پاسخی که فقط در محل پیدا می‌شود")
        STAFF = "staff", _("کدی که کارکنان محل می‌دهند")

    mystery = models.ForeignKey(Mystery, on_delete=models.CASCADE, related_name="steps", verbose_name=_("معما"))
    order = models.PositiveSmallIntegerField(default=1, verbose_name=_("مرحله"))
    clue = models.TextField(verbose_name=_("سرنخ"), help_text=_("متنی که بازیکن را به این محل می‌رساند (بدون نام محل)."))
    clue_image = models.ImageField(upload_to=mystery_upload, blank=True, verbose_name=_("تصویر سرنخ"))
    hint = models.CharField(
        max_length=300, blank=True, verbose_name=_("راهنمایی"), help_text=_("اگر بازیکن گیر کرد، با زدن «راهنمایی» می‌بیند.")
    )
    points = models.PositiveIntegerField(default=10, verbose_name=_("امتیاز مرحله"))

    proof = models.CharField(max_length=10, choices=Proof.choices, default=Proof.QR, verbose_name=_("روش تأیید حضور"))
    question = models.CharField(
        max_length=200,
        blank=True,
        verbose_name=_("پرسش"),
        help_text=_("برای «پاسخ در محل»: مثلاً «روی تابلوی سردر، سال ساخت چند است؟»"),
    )
    answers = models.CharField(
        max_length=300,
        blank=True,
        verbose_name=_("پاسخ‌های درست"),
        help_text=_("چند شکلِ درست را با | جدا کنید، مثلاً «۱۳۰۵|1305». فاصله، ی/ي و ک/ك و رقم فارسی/انگلیسی مهم نیست."),
    )
    staff_code = models.CharField(
        max_length=40,
        blank=True,
        verbose_name=_("کد کارکنان"),
        help_text=_("کدی که به کارکنان محل می‌دهید تا به بازیکنی که رسیده بگویند. اگر پخش شد، عوضش کنید."),
    )
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True, verbose_name=_("عرض جغرافیایی"))
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True, verbose_name=_("طول جغرافیایی"))
    radius_m = models.PositiveSmallIntegerField(
        default=100,
        validators=[MinValueValidator(20)],
        verbose_name=_("شعاع پذیرش (متر)"),
        help_text=_("بازیکن باید تا این فاصله از نقطه باشد. وسط شهر ۸۰ تا ۱۵۰ متر مناسب است."),
    )
    check_location = models.BooleanField(
        default=False,
        verbose_name=_("موقعیت گوشی را هم بسنج"),
        help_text=_("برای «پاسخ در محل» و «کد کارکنان»: علاوه بر پاسخ یا کد، گوشی هم باید در محل باشد."),
    )
    qr_token = models.CharField(max_length=40, unique=True, null=True, blank=True, editable=False)
    qr_rotating = models.BooleanField(
        default=False,
        verbose_name=_("QR متغیر روی نمایشگر محل"),
        help_text=_("به‌جای QR چاپی، تبلت یا تلویزیونِ محل لینک «نمایشگر» را باز می‌کند و هر ۳۰ ثانیه QR تازه نشان می‌دهد."),
    )
    qr_display_key = models.CharField(max_length=64, unique=True, null=True, blank=True, editable=False)

    # The place, shown once the step is solved.
    place_name = models.CharField(max_length=120, verbose_name=_("نام محل یا کسب‌وکار"))
    place_logo = models.ImageField(upload_to=mystery_upload, blank=True, verbose_name=_("لوگو یا عکس محل"))
    place_address = models.CharField(max_length=250, blank=True, verbose_name=_("نشانی"))
    place_about = models.TextField(blank=True, verbose_name=_("معرفی محل"))
    place_offer = models.CharField(
        max_length=200,
        blank=True,
        verbose_name=_("پیشنهاد ویژه"),
        help_text=_("مثلاً «۱۰٪ تخفیف با نشان دادن همین صفحه». بازیکن بعد از رسیدن می‌بیند."),
    )
    place_url = models.URLField(max_length=300, blank=True, verbose_name=_("سایت یا اینستاگرام"))
    map_url = models.URLField(
        max_length=500,
        blank=True,
        verbose_name=_("لینک نقشه"),
        help_text=_("خالی = از روی مختصات، لینک «نشان» ساخته می‌شود."),
    )

    class Meta(AbstractBaseModel.Meta):
        verbose_name = _("مرحلهٔ معما")
        verbose_name_plural = _("مرحله‌های معما")
        ordering = ("mystery", "order", "create_time")
        constraints = [models.UniqueConstraint(fields=("mystery", "order"), name="mystery_step_order")]

    def __str__(self):
        return f"{self.mystery} — {self.order}. {self.place_name}"

    @property
    def has_point(self) -> bool:
        return self.latitude is not None and self.longitude is not None

    def map_link(self) -> str:
        if self.map_url:
            return self.map_url
        if self.has_point:
            return f"https://neshan.org/maps/@{self.latitude},{self.longitude},17z"
        return ""

    def answer_list(self) -> list[str]:
        source = self.staff_code if self.proof == self.Proof.STAFF else self.answers
        return [a for a in (part.strip() for part in (source or "").split("|")) if a]

    def clean(self):
        super().clean()
        errors = {}
        if self.proof == self.Proof.GPS and not self.has_point:
            errors["latitude"] = _("برای «موقعیت گوشی»، مختصات محل لازم است.")
        if self.check_location and not self.has_point:
            errors["latitude"] = _("برای سنجیدن موقعیت گوشی، مختصات محل لازم است.")
        if self.check_location and self.proof not in (self.Proof.ANSWER, self.Proof.STAFF):
            errors["check_location"] = _("فقط برای «پاسخ در محل» و «کد کارکنان».")
        if self.proof == self.Proof.ANSWER and not self.answer_list():
            errors["answers"] = _("پاسخ درست را بنویسید.")
        if self.proof == self.Proof.ANSWER and not self.question.strip():
            errors["question"] = _("پرسشی که بازیکن در محل جوابش را پیدا می‌کند را بنویسید.")
        if self.proof == self.Proof.STAFF and not self.answer_list():
            errors["staff_code"] = _("کد کارکنان را بنویسید.")
        if self.qr_rotating and self.proof != self.Proof.QR:
            errors["qr_rotating"] = _("QR متغیر فقط برای «اسکن QR محل» است.")
        if self.latitude is not None and not -90 <= self.latitude <= 90:
            errors["latitude"] = _("عرض جغرافیایی بین ۹۰- و ۹۰ است.")
        if self.longitude is not None and not -180 <= self.longitude <= 180:
            errors["longitude"] = _("طول جغرافیایی بین ۱۸۰- و ۱۸۰ است.")
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        if self.proof == self.Proof.QR and not self.qr_token:
            self.qr_token = new_qr_token()
        if self.proof == self.Proof.QR and self.qr_rotating and not self.qr_display_key:
            self.qr_display_key = new_callback_secret()
        return super().save(*args, **kwargs)


class MysteryRun(AbstractBaseModel):
    """One player's game of one mystery (once per player; a new season is a new mystery)."""

    class Status(models.TextChoices):
        ACTIVE = "active", _("در حال بازی")
        COMPLETED = "completed", _("تمام شد")

    customer = models.ForeignKey("users.Customer", on_delete=models.PROTECT, related_name="mystery_runs")
    mystery = models.ForeignKey(Mystery, on_delete=models.PROTECT, related_name="runs", verbose_name=_("معما"))
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE, verbose_name=_("وضعیت"))
    # Wrong answers / codes at the current step: after a few, a short wait (no guessing by brute force).
    wrong_tries = models.PositiveSmallIntegerField(default=0)
    locked_until = models.DateTimeField(null=True, blank=True)
    points_earned = models.PositiveIntegerField(default=0, verbose_name=_("امتیاز گرفته"))
    completed_at = models.DateTimeField(null=True, blank=True, verbose_name=_("زمان پایان"))
    finish_transaction = models.OneToOneField(
        "wallet.ActivityTransaction", on_delete=models.PROTECT, null=True, blank=True, related_name="mystery_run"
    )

    class Meta(AbstractBaseModel.Meta):
        verbose_name = _("بازی معما")
        verbose_name_plural = _("بازی‌های معما")
        constraints = [models.UniqueConstraint(fields=("customer", "mystery"), name="mystery_run_once")]

    def __str__(self):
        return f"{self.mystery} — {self.customer} ({self.get_status_display()})"


class MysteryCheckin(AbstractBaseModel):
    """A solved step: the player was at the place (one visit in the foot-traffic report)."""

    run = models.ForeignKey(MysteryRun, on_delete=models.PROTECT, related_name="checkins")
    step = models.ForeignKey(MysteryStep, on_delete=models.PROTECT, related_name="checkins", verbose_name=_("مرحله"))
    customer = models.ForeignKey("users.Customer", on_delete=models.PROTECT, related_name="mystery_checkins")
    method = models.CharField(max_length=10, choices=MysteryStep.Proof.choices, verbose_name=_("روش"))
    points = models.PositiveIntegerField(default=0, verbose_name=_("امتیاز"))
    # How far from the place the phone said it was (when the location was checked).
    distance_m = models.PositiveIntegerField(null=True, blank=True, verbose_name=_("فاصله (متر)"))
    accuracy_m = models.PositiveIntegerField(null=True, blank=True, verbose_name=_("دقت موقعیت (متر)"))
    activity_transaction = models.OneToOneField(
        "wallet.ActivityTransaction", on_delete=models.PROTECT, null=True, blank=True, related_name="mystery_checkin"
    )

    class Meta(AbstractBaseModel.Meta):
        verbose_name = _("بازدید محل")
        verbose_name_plural = _("بازدیدهای محل‌ها")
        constraints = [models.UniqueConstraint(fields=("run", "step"), name="mystery_checkin_once")]
        indexes = [models.Index(fields=["step", "create_time"], name="mystery_checkin_step")]

    def __str__(self):
        return f"{self.step.place_name} — {self.customer}"
