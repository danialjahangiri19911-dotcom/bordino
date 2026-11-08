from django.contrib import admin, messages
from django.http import Http404, HttpResponseRedirect
from django.shortcuts import get_object_or_404
from django.template.response import TemplateResponse
from django.urls import path, reverse
from django.utils.html import format_html

from apps.gamemaster import budget, schema, services
from apps.gamemaster.models import CreatorProfile, Game, GameAuditLog, GameBudgetLedger, GamePayment, GameReview, GameVersion

STAGE_NAMES = {
    "question": "پرسش",
    "puzzle": "معما",
    "choice": "چندگزینه‌ای",
    "qr": "اسکن QR محل",
    "location": "موقعیت گوشی",
    "staff": "کد کارکنان",
    "media": "محتوا (ادامه)",
    "reward": "جایزه / کد تخفیف",
}


class ReadOnlyAdmin(admin.ModelAdmin):
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(CreatorProfile)
class CreatorProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "business_name", "intent", "preferred_mode", "terms_accepted_at", "is_blocked")
    list_filter = ("intent", "preferred_mode", "is_blocked")
    search_fields = ("user__phone_number", "business_name")
    readonly_fields = ("user", "terms_version", "terms_accepted_at", "preferred_mode")
    fields = ("user", "intent", "business_name", "business_phone", "preferred_mode", "terms_version", "terms_accepted_at", "is_blocked")

    def has_add_permission(self, request):
        return False


class VersionInline(admin.TabularInline):
    model = GameVersion
    extra = 0
    fields = ("number", "status", "submitted_at", "reviewer", "reviewed_at", "fee_toman", "fee_paid", "published_at", "review_link")
    readonly_fields = fields
    ordering = ("-number",)
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False

    @admin.display(description="بررسی")
    def review_link(self, obj):
        return format_html('<a href="{}">باز کردن</a>', reverse("admin:gamemaster_gameversion_review", args=[obj.pk]))


@admin.register(Game)
class GameAdmin(admin.ModelAdmin):
    list_display = ("title", "owner", "category", "status", "paused_by_admin", "live_version", "update_time")
    list_filter = ("status", "category", "paused_by_admin")
    search_fields = ("title", "owner__business_name", "owner__user__phone_number")
    readonly_fields = ("owner", "category", "template", "title", "status", "live_version", "paused_by_admin", "draft_saved_at", "budget")
    fields = readonly_fields
    inlines = (VersionInline,)
    actions = ("admin_pause", "admin_resume", "admin_archive")

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    @admin.display(description="بودجهٔ امتیاز")
    def budget(self, obj):
        if not obj or not obj.live_version:
            return "—"
        b = budget.summary(obj.live_version)
        return f"کنار گذاشته {b['reserved']} · پرداخت‌شده {b['spent']} · برگشته {b['released']} · مانده {b['left']}"

    def _run(self, request, queryset, call, done_text):
        done = 0
        for game in queryset:
            try:
                call(request.user, game.pk)
                done += 1
            except services.GameMasterError as exc:
                self.message_user(request, f"«{game}»: {exc.message}", messages.WARNING)
        if done:
            self.message_user(request, f"{done} بازی {done_text}.", messages.SUCCESS)

    @admin.action(description="توقف فوری (توسط بردینو)")
    def admin_pause(self, request, queryset):
        self._run(request, queryset, lambda u, g: services.set_paused(u, g, True, by_admin=True), "متوقف شد")

    @admin.action(description="ادامهٔ بازی متوقف‌شده")
    def admin_resume(self, request, queryset):
        self._run(request, queryset, lambda u, g: services.set_paused(u, g, False, by_admin=True), "دوباره باز شد")

    @admin.action(description="بایگانی (پایان بازی و برگشت بودجهٔ مانده)")
    def admin_archive(self, request, queryset):
        self._run(request, queryset, lambda u, g: services.archive(u, g, by_admin=True), "بایگانی شد")


@admin.register(GameVersion)
class GameVersionAdmin(ReadOnlyAdmin):
    """The review queue: «در انتظار بررسی» first; each version opens the review page."""

    list_display = ("game", "number", "category", "owner", "status", "submitted_at", "reviewer", "review_link")
    list_filter = ("status", "game__category")
    search_fields = ("game__title", "game__owner__business_name", "game__owner__user__phone_number")
    list_select_related = ("game__owner__user", "reviewer")

    def has_view_permission(self, request, obj=None):
        return services.is_reviewer(request.user) or super().has_view_permission(request, obj)

    @admin.display(description="نوع")
    def category(self, obj):
        return obj.game.get_category_display()

    @admin.display(description="سازنده")
    def owner(self, obj):
        return obj.game.owner

    @admin.display(description="بررسی")
    def review_link(self, obj):
        return format_html('<a class="button" href="{}">بررسی</a>', reverse("admin:gamemaster_gameversion_review", args=[obj.pk]))

    def get_urls(self):
        return [
            path("<uuid:pk>/review/", self.admin_site.admin_view(self.review_view), name="gamemaster_gameversion_review"),
            *super().get_urls(),
        ]

    def change_view(self, request, object_id, form_url="", extra_context=None):
        return HttpResponseRedirect(reverse("admin:gamemaster_gameversion_review", args=[object_id]))

    def review_view(self, request, pk):
        if not services.is_reviewer(request.user):
            raise Http404
        version = get_object_or_404(GameVersion.objects.select_related("game__owner__user"), pk=pk)
        if request.method == "POST":
            try:
                services.review(request.user, version.pk, request.POST.get("decision", ""), request.POST.get("note", ""))
                self.message_user(request, "تصمیم ثبت شد و به سازنده خبر داده شد.", messages.SUCCESS)
                return HttpResponseRedirect(reverse("admin:gamemaster_gameversion_changelist"))
            except services.GameMasterError as exc:
                self.message_user(request, exc.message, messages.ERROR)
        d = version.definition
        stages = []
        for i, s in enumerate(d.get("stages") or [], 1):
            stages.append({**s, "number": i, "type_name": STAGE_NAMES.get(s.get("type"), s.get("type")),
                           "map": f"https://neshan.org/maps/@{s['lat']},{s['lng']},17z" if schema.has_point(s) else ""})
        context = {
            **self.admin_site.each_context(request),
            "opts": self.model._meta,
            "title": f"بررسی «{version.game.title}» — نسخهٔ {version.number}",
            "version": version,
            "game": version.game,
            "d": d,
            "stages": stages,
            "max_run": schema.max_run_points(d),
            "problems": schema.check(d),
            "reviews": GameReview.objects.filter(version__game=version.game).select_related("reviewer", "version").order_by("-create_time"),
            "own_game": version.game.owner.user_id == request.user.pk,
            "can_decide": version.status == GameVersion.Status.SUBMITTED and version.game.owner.user_id != request.user.pk,
        }
        return TemplateResponse(request, "admin/gamemaster/review.html", context)


@admin.register(GameAuditLog)
class GameAuditLogAdmin(ReadOnlyAdmin):
    list_display = ("create_time", "game", "actor", "action", "data")
    list_filter = ("action",)
    search_fields = ("game__title", "actor__phone_number", "action")
    list_select_related = ("game", "actor")
    date_hierarchy = "create_time"


@admin.register(GameBudgetLedger)
class GameBudgetLedgerAdmin(ReadOnlyAdmin):
    list_display = ("create_time", "game", "version", "kind", "points", "key")
    list_filter = ("kind",)
    search_fields = ("game__title", "key")
    list_select_related = ("game", "version")


@admin.register(GamePayment)
class GamePaymentAdmin(ReadOnlyAdmin):
    list_display = ("create_time", "game", "creator", "amount_toman", "mode", "status", "ref_number", "verified_at")
    list_filter = ("status", "mode")
    search_fields = ("game__title", "track_id", "ref_number", "creator__user__phone_number")
    list_select_related = ("game", "creator__user")
