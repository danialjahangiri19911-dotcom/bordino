import base64

from django.conf import settings
from django.contrib import admin, messages
from django.http import FileResponse, Http404
from django.urls import path, reverse
from django.utils.html import format_html

from apps.missions import services
from apps.missions.models import Mission, MissionAttempt, MissionCategory, new_callback_secret, new_qr_token


def public_url(path_: str) -> str:
    return f"{settings.MISSIONS_PUBLIC_URL.rstrip('/')}{path_}"


def qr_link(mission: Mission) -> str:
    return public_url(f"/pwa/earn/qr/{mission.qr_token}")


def venue_link(mission: Mission) -> str:
    return public_url(f"/venue/{mission.qr_display_key}")


def callback_link(mission: Mission) -> str:
    return public_url(f"/api/v1/missions/callback/{mission.pk}/?click_id={{click_id}}&secret={mission.callback_secret}")


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
        if obj.qr_rotating:
            return "این مأموریت QR متغیر دارد: QR چاپی ندارد؛ لینک نمایشگر را در محل باز کنید."
        import segno  # pylint: disable=import-outside-toplevel

        link = qr_link(obj)
        svg = segno.make(link, error="m").svg_inline(scale=6, border=2)
        data = base64.b64encode(svg.encode()).decode()
        return format_html(
            '<img src="data:image/svg+xml;base64,{}" alt="QR" style="width:220px;height:220px;background:#fff"><br>'
            '<a href="data:image/svg+xml;base64,{}" download="mission-qr.svg">دانلود QR (SVG)</a><br><code>{}</code>',
            data,
            data,
            link,
        )

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
        link = venue_link(obj)
        return format_html(
            '<a href="{}" target="_blank" rel="noopener">{}</a><br>'
            "این لینک را روی تبلت یا تلویزیونِ محل باز کنید (تمام‌صفحه). هر ۳۰ ثانیه QR عوض می‌شود. "
            "لینک را به کسی جز مسئول محل ندهید؛ اگر پخش شد، با «ساخت QR تازه» عوضش کنید.",
            link,
            link,
        )

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
