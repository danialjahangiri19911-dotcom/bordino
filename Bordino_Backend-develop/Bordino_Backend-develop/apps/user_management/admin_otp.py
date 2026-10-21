"""SMS-code login for the Django admin.

Replaces the admin's password form: a phone number on ADMIN_OTP_WHITELIST gets a
one-time code by SMS, and that code is the only way into /admin/. Numbers outside
the list never receive an SMS, and the page answers them exactly like a listed
number, so it cannot be used to probe the list. ADMIN_PASSWORD_LOGIN=true brings
the stock password form back (break-glass; see main_app/urls.py).
"""

import hashlib
import hmac
import secrets

from django.conf import settings
from django.contrib import admin
from django.contrib.auth import get_user_model
from django.contrib.auth import login as auth_login
from django.core.cache import cache
from django.shortcuts import redirect
from django.template.response import TemplateResponse
from django.urls import reverse
from django.utils.http import url_has_allowed_host_and_scheme
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.debug import sensitive_post_parameters

from apps.user_management.services.sms.sms import SMSService

CODE_LENGTH = 6
CODE_TTL = 180  # seconds a code stays valid
MAX_ATTEMPTS = 5  # wrong guesses before the code is burned
RESEND_GAP = 60  # seconds between two SMS to the same number
MAX_SENDS_PER_HOUR = 5
SESSION_PHONE = "admin_otp_phone"


def normalize_phone(raw):
    """09121234567 / +989121234567 / ۰۹۱۲… → 9121234567 (the User.phone_number form)."""
    digits = "".join(str(int(ch)) for ch in str(raw or "") if ch.isdecimal())
    if digits.startswith("0098"):
        digits = digits[4:]
    elif digits.startswith("98") and len(digits) == 12:
        digits = digits[2:]
    elif digits.startswith("0") and len(digits) == 11:
        digits = digits[1:]
    return digits if len(digits) == 10 and digits.startswith("9") else ""


def whitelist():
    return {p for p in map(normalize_phone, settings.ADMIN_OTP_WHITELIST) if p}


def _admin_user(phone):
    if phone not in whitelist():
        return None
    return get_user_model().objects.filter(phone_number=phone, is_active=True, is_admin=True).first()


def _digest(phone, code):
    msg = f"admin-otp:{phone}:{code}".encode()
    return hmac.new(settings.SECRET_KEY.encode(), msg, hashlib.sha256).hexdigest()


def _keys(phone):
    base = f"admin_otp:{phone}"
    return f"{base}:code", f"{base}:tries", f"{base}:gap", f"{base}:hour"


def send_code(phone):
    """Returns "sent", "wait", "limit" or "sms_failed". An unlisted number also gets
    "sent" (nothing is sent) so the answer reveals nothing about the list."""
    code_key, tries_key, gap_key, hour_key = _keys(phone)
    # Throttle before the list check so listed and unlisted numbers behave alike.
    if not cache.add(gap_key, 1, RESEND_GAP):
        return "wait"
    cache.add(hour_key, 0, 3600)
    if cache.incr(hour_key) > MAX_SENDS_PER_HOUR:
        return "limit"
    if _admin_user(phone) is None:
        return "sent"

    code = "".join(secrets.choice("0123456789") for _ in range(CODE_LENGTH))
    cache.set(code_key, _digest(phone, code), CODE_TTL)
    cache.set(tries_key, 0, CODE_TTL)
    if SMSService().send_sms(phone, code) is None:
        cache.delete_many([code_key, tries_key, gap_key])
        return "sms_failed"
    return "sent"


def verify_code(phone, code):
    """The admin user if `code` is the live code for `phone`, else None. Single use."""
    code_key, tries_key, _gap, _hour = _keys(phone)
    expected = cache.get(code_key)
    if not expected:
        return None
    cache.add(tries_key, 0, CODE_TTL)
    if cache.incr(tries_key) > MAX_ATTEMPTS:
        cache.delete(code_key)
        return None
    given = "".join(str(int(ch)) for ch in str(code or "") if ch.isdecimal())
    if not hmac.compare_digest(expected, _digest(phone, given)):
        return None
    # delete() is True only for the request that actually removed the key.
    if not cache.delete(code_key):
        return None
    cache.delete(tries_key)
    return _admin_user(phone)


def _mask(phone):
    return f"{phone[:3]}***{phone[-4:]}" if phone else ""


SEND_MESSAGES = {
    "sent": ("info", "اگر این شماره مجاز باشد، کد ورود پیامک شد."),
    "wait": ("error", "کمی صبر کنید؛ هر دقیقه فقط یک کد فرستاده می‌شود."),
    "limit": ("error", "تعداد درخواست کد در این ساعت زیاد بوده است؛ بعداً دوباره تلاش کنید."),
    "sms_failed": ("error", "ارسال پیامک ناموفق بود؛ دوباره تلاش کنید."),
}


@sensitive_post_parameters("code")
@csrf_protect
@never_cache
def admin_otp_login(request, extra_context=None):
    next_url = request.POST.get("next") or request.GET.get("next") or ""
    if not url_has_allowed_host_and_scheme(
        next_url, allowed_hosts={request.get_host()}, require_https=request.is_secure()
    ):
        next_url = reverse("admin:index")

    if request.method == "GET" and request.user.is_active and request.user.is_staff:
        return redirect(next_url)

    step, info, error = "phone", "", ""
    phone = request.session.get(SESSION_PHONE, "")
    action = request.POST.get("action") if request.method == "POST" else None

    if action in ("send", "resend"):
        if action == "send":
            phone = normalize_phone(request.POST.get("phone"))
        if not phone:
            error = "شمارهٔ موبایل معتبر نیست."
        else:
            request.session[SESSION_PHONE] = phone
            kind, text = SEND_MESSAGES[send_code(phone)]
            info, error = (text, "") if kind == "info" else ("", text)
            step = "code"
    elif action == "verify" and phone:
        user = verify_code(phone, request.POST.get("code"))
        if user is not None:
            request.session.pop(SESSION_PHONE, None)
            auth_login(request, user, backend="django.contrib.auth.backends.ModelBackend")
            return redirect(next_url)
        error, step = "کد نادرست یا منقضی است.", "code"
    elif action == "restart":
        request.session.pop(SESSION_PHONE, None)
        phone = ""

    context = {
        **admin.site.each_context(request),
        "title": "ورود مدیر",
        "step": step,
        "phone_hint": _mask(phone),
        "next": next_url,
        "info": info,
        "error": error,
        **(extra_context or {}),
    }
    return TemplateResponse(request, "admin/otp_login.html", context)
