from django.conf import settings
from django.contrib import messages
from django.contrib.admin import register

from apps.django_helper.admin.base import BaseAdmin
from apps.wallet.models import AdRewardSession


@register(AdRewardSession)
class AdRewardSessionAdmin(BaseAdmin):
    """Rewarded-ad views, for reports. Read-only: rewards are paid by the service, never by hand
    (the reward amount and daily limit are the AD_REWARD_* system configurations)."""

    list_display = ("id", "customer", "provider", "placement", "reward_points", "status", "verified_at", "create_time", "completed_at")
    list_filter = ("status", "provider", "placement")
    search_fields = ("customer__user__phone_number",)
    readonly_fields = tuple(f.name for f in AdRewardSession._meta.fields)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def changelist_view(self, request, extra_context=None):
        # The address to enter in the Adivery panel (rewarded placement → server confirmation). It
        # carries the secret that pays rewards: shown to superusers only, here and nowhere else.
        if request.user.is_superuser and request.method == "GET":
            from apps.wallet.services import ad_reward  # pylint: disable=import-outside-toplevel

            base = getattr(settings, "MISSIONS_PUBLIC_URL", "https://lottery.bordino.co").rstrip("/")
            messages.info(
                request,
                f"آدرس تأیید جایزهٔ ادیوری (در پنل ادیوری، تنظیمات تبلیغ‌گاه جایزه‌ای): "
                f"{base}/api/v1/wallet/ad-reward/adivery/{ad_reward.adivery_callback_secret()}/ "
                "— این آدرس را فقط در پنل ادیوری وارد کنید و جای دیگری نفرستید.",
            )
        return super().changelist_view(request, extra_context)
