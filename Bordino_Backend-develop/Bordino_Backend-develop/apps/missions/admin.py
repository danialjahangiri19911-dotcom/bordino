import base64
import re
import uuid
from decimal import Decimal, InvalidOperation

from django import forms
from django.conf import settings
from django.contrib import admin, messages
from django.db import transaction
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from django.template.response import TemplateResponse
from django.urls import path, reverse
from django.utils.html import format_html

from apps.missions import mystery as mysteries
from apps.missions import services
from apps.missions.models import (
    Mission,
    MissionAttempt,
    MissionCategory,
    Mystery,
    MysteryCheckin,
    MysteryRun,
    MysteryStep,
    new_callback_secret,
    new_qr_token,
)


def public_url(path_: str) -> str:
    return f"{settings.MISSIONS_PUBLIC_URL.rstrip('/')}{path_}"


def qr_link(mission: "Mission | MysteryStep") -> str:
    return public_url(f"/pwa/earn/qr/{mission.qr_token}")


def venue_link(mission: "Mission | MysteryStep") -> str:
    return public_url(f"/venue/{mission.qr_display_key}")


def callback_link(mission: Mission) -> str:
    return public_url(f"/api/v1/missions/callback/{mission.pk}/?click_id={{click_id}}&secret={mission.callback_secret}")


def printable_qr(obj, filename: str):
    """The QR to print (a mission's or a mystery step's), or why there is none."""
    if obj.qr_rotating:
        return "QR متغیر دارد: QR چاپی ندارد؛ لینک نمایشگر را در محل باز کنید."
    import segno  # pylint: disable=import-outside-toplevel

    link = qr_link(obj)
    svg = segno.make(link, error="m").svg_inline(scale=6, border=2)
    data = base64.b64encode(svg.encode()).decode()
    return format_html(
        '<img src="data:image/svg+xml;base64,{}" alt="QR" style="width:220px;height:220px;background:#fff"><br>'
        '<a href="data:image/svg+xml;base64,{}" download="{}">دانلود QR (SVG)</a><br><code>{}</code>',
        data,
        data,
        filename,
        link,
    )


def venue_screen_html(obj):
    link = venue_link(obj)
    return format_html(
        '<a href="{}" target="_blank" rel="noopener">{}</a><br>'
        "این لینک را روی تبلت یا تلویزیونِ محل باز کنید (تمام‌صفحه). هر ۳۰ ثانیه QR عوض می‌شود. "
        "لینک را به کسی جز مسئول محل ندهید؛ اگر پخش شد، با «ساخت QR تازه» عوضش کنید.",
        link,
        link,
    )


@admin.register(MissionCategory)
class MissionCategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "icon", "order", "is_active")
    list_editable = ("order", "is_active")


@admin.register(Mission)
class MissionAdmin(admin.ModelAdmin):
    list_display = ("title", "category", "kind", "verification", "points", "repeat", "is_active", "is_visible", "order", "create_time")
    list_filter = ("kind", "verification", "is_active", "is_visible", "category")
    list_editable = ("is_active", "is_visible", "order")
    search_fields = ("title", "partner_name")
    readonly_fields = ("qr_code", "partner_callback")
    actions = ("new_qr",)

    @admin.action(description="ساخت QR تازه (QR و لینک نمایشگر قبلی دیگر کار نمی‌کنند)", permissions=["change"])
    def new_qr(self, request, queryset):
        done = 0
        for mission in queryset.filter(kind=Mission.Kind.QR):
            Mission.objects.filter(pk=mission.pk).update(
                qr_token=new_qr_token(), qr_display_key=new_callback_secret() if mission.qr_rotating else None
            )
            done += 1
        self.message_user(
            request,
            f"برای {done} مأموریت QR تازه ساخته شد؛ QR چاپی را دوباره چاپ کنید و لینک تازهٔ نمایشگر را روی نمایشگر محل باز کنید.",
            messages.SUCCESS,
        )
    fieldsets = (
        (None, {"fields": ("title", "summary", "description", "category", "kind", "verification", "points")}),
        ("تکرار و زمان", {"fields": ("repeat", "daily_limit", "starts_at", "ends_at", "capacity")}),
        ("لینک و همکار", {"fields": ("link_url", "partner_name", "image", "min_seconds")}),
        ("مدرک (بررسی ادمین)", {"fields": ("proof_label", "proof_image_required")}),
        ("نمایش", {"fields": ("is_active", "is_visible", "order")}),
        ("QR و سرور همکار", {"fields": ("qr_rotating", "qr_code", "venue_screen", "partner_callback")}),
    )

    @admin.display(description="QR برای چاپ")
    def qr_code(self, obj):
        if not obj or obj.kind != Mission.Kind.QR or not obj.qr_token:
            return "برای مأموریت QR، بعد از ذخیره ساخته می‌شود."
        return printable_qr(obj, "mission-qr.svg")

    # The partner's key pays points: only those who may change missions see it (others get the
    # same row without the key).
    # The same for the venue screen's link: whoever has it can show the current code anywhere.
    SECRET_FIELDS = ("partner_callback", "venue_screen")

    def _secret_field(self, request, obj, name):
        return name if self.has_change_permission(request, obj) else f"{name}_hidden"

    def _callback_field(self, request, obj):
        return self._secret_field(request, obj, "partner_callback")

    def get_readonly_fields(self, request, obj=None):
        return ("qr_code", *(self._secret_field(request, obj, f) for f in self.SECRET_FIELDS))

    def get_fieldsets(self, request, obj=None):
        names = {f: self._secret_field(request, obj, f) for f in self.SECRET_FIELDS}
        return [
            (title, {**opts, "fields": tuple(names.get(f, f) for f in opts["fields"])})
            for title, opts in self.fieldsets
        ]

    @admin.display(description="لینک نمایشگر محل")
    def venue_screen(self, obj):
        if not obj or obj.kind != Mission.Kind.QR or not obj.qr_rotating:
            return "برای «QR متغیر روی نمایشگر محل»، بعد از ذخیره ساخته می‌شود."
        if not obj.qr_display_key:
            return "بعد از ذخیره ساخته می‌شود."
        return venue_screen_html(obj)

    @admin.display(description="لینک نمایشگر محل")
    def venue_screen_hidden(self, obj):
        return "فقط کسی که اجازهٔ ویرایش مأموریت دارد لینک را می‌بیند."

    @admin.display(description="آدرس تأیید برای سرور همکار")
    def partner_callback_hidden(self, obj):
        return "فقط کسی که اجازهٔ ویرایش مأموریت دارد کلید را می‌بیند."

    @admin.display(description="آدرس تأیید برای سرور همکار")
    def partner_callback(self, obj):
        if not obj or obj.verification != Mission.Verification.CALLBACK or not obj.callback_secret:
            return "برای تأیید سرور همکار، بعد از ذخیره ساخته می‌شود."
        return format_html(
            "<code>{}</code><br>همکار بعد از ثبت‌نام/نصب، این آدرس را با همان click_id که در لینک گرفته صدا می‌زند (GET یا POST). "
            "کلید را فقط به همکار بدهید.",
            callback_link(obj),
        )


@admin.register(MissionAttempt)
class MissionAttemptAdmin(admin.ModelAdmin):
    list_display = ("create_time", "mission", "customer", "status", "points", "proof_text", "proof", "submitted_at", "completed_at")
    list_filter = ("status", "mission__kind", "mission")
    search_fields = ("customer__user__phone_number", "mission__title", "proof_text")
    list_select_related = ("mission", "customer__user")
    ordering = ("-create_time",)
    actions = ("approve_selected", "reject_selected")
    fields = (
        "mission", "customer", "status", "points", "proof_text", "proof_preview", "opened_at", "submitted_at",
        "review_note", "reviewed_at", "reviewed_by", "completed_at", "click_id",
    )
    readonly_fields = (
        "mission", "customer", "status", "points", "proof_text", "proof_preview", "opened_at", "submitted_at",
        "reviewed_at", "reviewed_by", "completed_at", "click_id",
    )

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def get_urls(self):
        return [
            path(
                "<uuid:pk>/proof/",
                self.admin_site.admin_view(self.proof_view),
                name="missions_missionattempt_proof",
            ),
            *super().get_urls(),
        ]

    def proof_view(self, request, pk):
        attempt = MissionAttempt.objects.filter(pk=pk).first()
        if attempt is None or not attempt.proof_image or not self.has_view_permission(request, attempt):
            raise Http404
        ext = attempt.proof_image.name.rsplit(".", 1)[-1].lower()
        response = FileResponse(
            attempt.proof_image.open("rb"), content_type={"png": "image/png", "webp": "image/webp"}.get(ext, "image/jpeg")
        )
        response["Content-Security-Policy"] = "default-src 'none'; img-src 'self'; sandbox"
        response["X-Content-Type-Options"] = "nosniff"
        return response

    def _proof_url(self, obj):
        return reverse("admin:missions_missionattempt_proof", args=[obj.pk])

    @admin.display(description="اسکرین‌شات")
    def proof(self, obj):
        if not obj.proof_image:
            return "—"
        return format_html('<a href="{}" target="_blank">مشاهده</a>', self._proof_url(obj))

    @admin.display(description="اسکرین‌شات")
    def proof_preview(self, obj):
        if not obj or not obj.proof_image:
            return "—"
        url = self._proof_url(obj)
        return format_html('<a href="{}" target="_blank"><img src="{}" style="max-width:320px;max-height:480px"></a>', url, url)

    def save_model(self, request, obj, form, change):
        # Only the review note is edited here; the status moves through the actions (which pay).
        if change and "review_note" in form.changed_data:
            obj.save(update_fields=["review_note", "update_time"])

    @admin.action(description="تأیید و پرداخت امتیاز", permissions=["change"])
    def approve_selected(self, request, queryset):
        done = sum(1 for pk in queryset.values_list("pk", flat=True) if services.approve(pk, by=request.user))
        self.message_user(request, f"{done} مورد تأیید و پرداخت شد.", messages.SUCCESS)

    @admin.action(description="رد (با «پیام بررسی» هر مورد)", permissions=["change"])
    def reject_selected(self, request, queryset):
        done = sum(1 for pk in queryset.values_list("pk", flat=True) if services.reject(pk, by=request.user))
        self.message_user(request, f"{done} مورد رد شد.", messages.WARNING)


# ── «معمای شهری» ──

_DIGITS = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩٫،", "01234567890123456789.,")


def parse_point(text: str) -> tuple[Decimal, Decimal] | None:
    """«35.7001, 51.3912» (as copied from Google Maps or Neshan; Persian digits too) → (lat, lng)."""
    numbers = re.findall(r"-?\d+(?:\.\d+)?", (text or "").translate(_DIGITS))
    if len(numbers) != 2:
        return None
    try:
        return Decimal(numbers[0]).quantize(Decimal("0.000001")), Decimal(numbers[1]).quantize(Decimal("0.000001"))
    except InvalidOperation:
        return None


class MysteryStepForm(forms.ModelForm):
    point = forms.CharField(
        required=False,
        label="مختصات محل",
        help_text="در گوگل‌مپ یا نشان روی محل نگه دارید و عددها را کپی کنید، مثلاً 35.700100, 51.391200. "
        "برای «موقعیت گوشی» لازم است؛ لینک نقشه هم از آن ساخته می‌شود.",
        widget=forms.TextInput(attrs={"dir": "ltr", "placeholder": "35.700100, 51.391200", "style": "width:16em"}),
    )

    class Meta:
        model = MysteryStep
        exclude = ("latitude", "longitude")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance and self.instance.has_point:
            self.fields["point"].initial = f"{self.instance.latitude}, {self.instance.longitude}"

    def clean_point(self):
        text = (self.cleaned_data.get("point") or "").strip()
        if not text:
            return None
        point = parse_point(text)
        if point is None:
            raise forms.ValidationError("دو عدد بنویسید: عرض و طول جغرافیایی، مثلاً 35.700100, 51.391200")
        return point

    def _post_clean(self):
        point = self.cleaned_data.get("point")
        if "point" in self.cleaned_data:
            self.instance.latitude, self.instance.longitude = point if point else (None, None)
        super()._post_clean()

    def _update_errors(self, errors):
        # The model names latitude / longitude; on this form they are the one «مختصات محل» field.
        if hasattr(errors, "error_dict"):
            for name in ("latitude", "longitude"):
                if name in errors.error_dict:
                    errors.error_dict.setdefault("point", []).extend(errors.error_dict.pop(name))
        super()._update_errors(errors)


class MysteryStepInline(admin.StackedInline):
    model = MysteryStep
    form = MysteryStepForm
    extra = 0
    ordering = ("order", "create_time")
    fieldsets = (
        ("سرنخ و راهنمایی", {"fields": ("order", "clue", "clue_image", "hints", "points", "time_limit_s", "coupon_text")}),
        (
            "محل (بعد از رسیدن به بازیکن نشان داده می‌شود)",
            {"fields": ("place_name", "place_logo", "place_address", "place_about", "place_offer", "place_url", "point", "map_url")},
        ),
        (
            "تأیید حضور",
            {"fields": ("proof", "question", "answer_type", "options", "answers", "staff_code", "is_place", "radius_m", "check_location", "qr_rotating", "qr_code", "venue_screen")},
        ),
    )

    # A creator's game (Game Master) is played exactly as it was approved: its steps are read-only.
    def has_change_permission(self, request, obj=None):
        return not (obj is not None and obj.is_creator_game) and super().has_change_permission(request, obj)

    def has_add_permission(self, request, obj=None):
        return not (obj is not None and obj.is_creator_game) and super().has_add_permission(request, obj)

    def has_delete_permission(self, request, obj=None):
        return not (obj is not None and obj.is_creator_game) and super().has_delete_permission(request, obj)

    def get_readonly_fields(self, request, obj=None):
        return ("qr_code", "venue_screen" if self.has_change_permission(request, obj) else "venue_screen_hidden")

    def get_fieldsets(self, request, obj=None):
        if self.has_change_permission(request, obj):
            return self.fieldsets
        return [
            (title, {**opts, "fields": tuple("venue_screen_hidden" if f == "venue_screen" else f for f in opts["fields"])})
            for title, opts in self.fieldsets
        ]

    @admin.display(description="QR برای چاپ")
    def qr_code(self, obj):
        if not obj or not obj.pk or obj.proof != MysteryStep.Proof.QR or not obj.qr_token:
            return "برای «اسکن QR محل»، بعد از ذخیره ساخته می‌شود."
        return printable_qr(obj, f"mystery-step-{obj.order}.svg")

    @admin.display(description="لینک نمایشگر محل")
    def venue_screen(self, obj):
        if not obj or not obj.pk or obj.proof != MysteryStep.Proof.QR or not obj.qr_rotating or not obj.qr_display_key:
            return "برای «QR متغیر روی نمایشگر محل»، بعد از ذخیره ساخته می‌شود."
        return venue_screen_html(obj)

    @admin.display(description="لینک نمایشگر محل")
    def venue_screen_hidden(self, obj):
        return "فقط کسی که اجازهٔ ویرایش دارد لینک را می‌بیند."


@admin.register(Mystery)
class MysteryAdmin(admin.ModelAdmin):
    list_display = ("title", "presenter", "area", "step_count", "finish_points", "players", "report_link", "is_active", "is_visible", "order")
    list_filter = ("is_active", "is_visible", "access", ("owner", admin.EmptyFieldListFilter))
    list_editable = ("is_active", "is_visible", "order")
    search_fields = ("title", "area", "steps__place_name")
    inlines = (MysteryStepInline,)
    actions = ("new_season", "new_qr")
    fieldsets = (
        (None, {"fields": ("title", "summary", "story", "cover", "area", "duration_minutes")}),
        ("جایزه، زمان و ظرفیت", {"fields": ("finish_points", "hint_penalty", "starts_at", "ends_at", "grace_ends_at", "capacity")}),
        ("نمایش", {"fields": ("is_active", "is_visible", "order")}),
        (
            "بازی سازنده (گیم مستر)",
            {
                "classes": ("collapse",),
                "fields": ("owner", "source_version", "presenter", "access", "completion_message", "age_min", "age_max", "gender", "budget_points", "edition", "leaderboard"),
            },
        ),
    )
    CREATOR_LOCKED = (
        "title", "summary", "story", "cover", "area", "duration_minutes", "finish_points", "hint_penalty", "starts_at",
        "ends_at", "capacity", "owner", "source_version", "presenter", "access", "completion_message", "age_min",
        "age_max", "gender", "budget_points", "grace_ends_at", "edition", "leaderboard",
    )

    def get_readonly_fields(self, request, obj=None):
        # A creator's game: as approved, its switch and listing too. Pausing, resuming and ending go
        # through «بازی‌های سازندگان» / «بردینو ادمین», which keep its budget right (switching an
        # archived game back on here would let its players earn points already given back).
        if obj is not None and obj.is_creator_game:
            return self.CREATOR_LOCKED + ("is_active", "is_visible")
        return ("owner", "source_version")

    def save_model(self, request, obj, form, change):
        # (also the list page's editable columns, which skip the read-only fields above)
        if change and obj.is_creator_game:
            locked = {"is_active", "is_visible"} & set(form.changed_data)
            if locked:
                for name in locked:
                    setattr(obj, name, form.initial.get(name, getattr(type(obj).objects.get(pk=obj.pk), name)))
                messages.warning(request, f"«{obj.title}»: روشن و خاموش کردن بازی سازنده فقط از «بازی‌های سازندگان» انجام می‌شود.")
        super().save_model(request, obj, form, change)

    def get_queryset(self, request):
        from django.db.models import Count  # pylint: disable=import-outside-toplevel

        return super().get_queryset(request).annotate(
            n_steps=Count("steps", distinct=True), n_runs=Count("runs", distinct=True)
        )

    @admin.display(description="مرحله‌ها", ordering="n_steps")
    def step_count(self, obj):
        return obj.n_steps

    @admin.display(description="بازیکنان", ordering="n_runs")
    def players(self, obj):
        return obj.n_runs

    @admin.display(description="گزارش")
    def report_link(self, obj):
        return format_html('<a href="{}">بازدید محل‌ها</a>', reverse("admin:missions_mystery_report", args=[obj.pk]))

    def get_urls(self):
        return [
            path("<uuid:pk>/report/", self.admin_site.admin_view(self.report_view), name="missions_mystery_report"),
            *super().get_urls(),
        ]

    def report_view(self, request, pk):
        mystery = get_object_or_404(Mystery, pk=pk)
        if not self.has_view_permission(request, mystery):
            raise Http404
        context = {
            **self.admin_site.each_context(request),
            "opts": self.model._meta,
            "title": f"بازدید محل‌ها — {mystery.title}",
            "mystery": mystery,
            "report": mysteries.report(mystery),
            "checkins_url": reverse("admin:missions_mysterycheckin_changelist") + f"?step__mystery__id__exact={mystery.pk}",
        }
        return TemplateResponse(request, "admin/missions/mystery_report.html", context)

    @admin.action(description="کپی برای فصل تازه (همه دوباره می‌توانند بازی کنند)", permissions=["add"])
    def new_season(self, request, queryset):
        made = 0
        for source in queryset:
            if source.is_creator_game:
                # A creator's game changes only through a new reviewed version (Game Master).
                self.message_user(request, f"«{source.title}» بازی سازنده است و کپی نمی‌شود.", messages.WARNING)
                continue
            with transaction.atomic():
                steps = list(source.steps.order_by("order", "create_time"))
                copy = Mystery.objects.get(pk=source.pk)
                copy.pk, copy._state.adding = uuid.uuid4(), True
                copy.title = f"{source.title} (فصل تازه)"[:120]
                copy.is_active = False
                copy.save()
                for step in steps:
                    step.pk, step._state.adding = uuid.uuid4(), True
                    step.mystery = copy
                    step.qr_token = None
                    step.qr_display_key = None
                    step.save()
                made += 1
        self.message_user(
            request,
            f"{made} معما کپی شد (غیرفعال). تاریخ‌ها را تنظیم و فعالش کنید؛ QRهای چاپی تازه ساخته شده‌اند.",
            messages.SUCCESS,
        )

    @admin.action(description="ساخت QR تازه برای همهٔ مرحله‌ها (QR و لینک نمایشگر قبلی دیگر کار نمی‌کنند)", permissions=["change"])
    def new_qr(self, request, queryset):
        done = 0
        for step in MysteryStep.objects.filter(mystery__in=queryset, proof=MysteryStep.Proof.QR):
            MysteryStep.objects.filter(pk=step.pk).update(
                qr_token=new_qr_token(), qr_display_key=new_callback_secret() if step.qr_rotating else None
            )
            done += 1
        self.message_user(request, f"برای {done} مرحله QR تازه ساخته شد؛ دوباره چاپ کنید.", messages.SUCCESS)


# MysteryRun's admin (with «حذف از جدول») is in apps.gamemaster.admin.


@admin.register(MysteryCheckin)
class MysteryCheckinAdmin(admin.ModelAdmin):
    """Every visit: what the foot-traffic report counts."""

    list_display = ("create_time", "place", "mystery", "customer", "method", "points", "distance_m", "accuracy_m")
    list_filter = ("step__mystery", "method", "step")
    search_fields = ("customer__user__phone_number", "step__place_name", "step__mystery__title")
    list_select_related = ("step__mystery", "customer__user")
    date_hierarchy = "create_time"
    ordering = ("-create_time",)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    @admin.display(description="محل", ordering="step__place_name")
    def place(self, obj):
        return obj.step.place_name

    @admin.display(description="معما", ordering="step__mystery__title")
    def mystery(self, obj):
        return obj.step.mystery.title
