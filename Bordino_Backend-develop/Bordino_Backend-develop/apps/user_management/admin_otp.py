"""SMS-code login for the Django admin.

Replaces the admin's password form: a phone number on ADMIN_OTP_WHITELIST gets a
one-time code by SMS, and that code is the only way into /admin/. Numbers outside
the list never receive an SMS, and the page answers them exactly like a listed
number, so it cannot be used to probe the list. ADMIN_PASSWORD_LOGIN=true brings
the stock password form back (break-glass; see main_app/urls.py).
"""

import hashlib
import hmac
import logging
import secrets
from concurrent.futures import ThreadPoolExecutor

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


def _digest(phone, code, scope="admin"):
    msg = f"{scope}-otp:{phone}:{code}".encode()
    return hmac.new(settings.SECRET_KEY.encode(), msg, hashlib.sha256).hexdigest()


def _keys(phone, scope="admin"):
    base = f"{scope}_otp:{phone}"
    return f"{base}:code", f"{base}:tries", f"{base}:gap", f"{base}:hour"


# Each code is its own challenge: the stored record is "<challenge id>:<digest>", and its guesses and
# its single use are counted under that id (a resend is a new id: never touched by an older check).
def _challenge_keys(phone, scope, challenge):
    base = f"{scope}_otp:{phone}"
    return f"{base}:tries:{challenge}", f"{base}:used:{challenge}"


def _burn(phone, scope, challenge):
    """This code no longer works (too many guesses, or its SMS failed). Marked on the code itself, never by
    removing the shared entry: by then it may hold a newer code."""
    cache.add(f"{scope}_otp:{phone}:burned:{challenge}", 1, CODE_TTL)


def _burned(phone, scope, challenge) -> bool:
    return bool(cache.get(f"{scope}_otp:{phone}:burned:{challenge}"))


_SMS_POOL = ThreadPoolExecutor(max_workers=2, thread_name_prefix="otp-sms")


def _deliver(job):
    """Runs the SMS in the background: how long the gateway takes (or whether it fails) never shows
    in the answer, which would tell a listed number from any other."""
    _SMS_POOL.submit(job)


def send_code(phone, who=None, scope="admin"):
    """Returns "sent", "wait" or "limit". Every number gets "sent" after the same work (a code
    record is kept for it); only a listed number is actually sent its code, in the background.

    `who(phone)` is the user allowed to log in with this number, or None (default: the Django
    admin's allowlist); `scope` keeps each login's codes and limits apart (the admin app: "ops")."""
    who = who or _admin_user
    code_key, _tries, gap_key, hour_key = _keys(phone, scope)  # pylint: disable=unused-variable
    # Throttle before the list check so listed and unlisted numbers behave alike.
    if not cache.add(gap_key, 1, RESEND_GAP):
        return "wait"
    cache.add(hour_key, 0, 3600)
    if cache.incr(hour_key) > MAX_SENDS_PER_HOUR:
        return "limit"
    allowed = who(phone) is not None
    code = "".join(secrets.choice("0123456789") for _ in range(CODE_LENGTH))
    challenge = secrets.token_hex(8)
    record = f"{challenge}:{_digest(phone, code, scope)}"
    cache.set(code_key, record, CODE_TTL)
    if not allowed:
        return "sent"  # (nobody knows this code; checking it still finds no user)

    def job():
        # (waited in the queue: a code already replaced by a newer one, or expired, is not sent)
        if cache.get(code_key) != record:
            return
        try:
            ok = SMSService().send_sms(phone, code) is not None
        except Exception:  # pylint: disable=broad-except
            ok = False
        if not ok:
            logging.getLogger(__name__).warning("%s sign-in SMS failed", scope)
            # The code never arrived: it is burned. (The one-minute gap stays, as for any other
            # number: a quicker second try would tell that this one is listed.)
            _burn(phone, scope, challenge)

    _deliver(job)
    return "sent"


def verify_code(phone, code, who=None, scope="admin"):
    """The allowed user if `code` is the live code for `phone`, else None. Single use."""
    who = who or _admin_user
    code_key, _tries, _gap, _hour = _keys(phone, scope)
    record = cache.get(code_key)
    if not record:
        return None
    challenge, _sep, expected = str(record).rpartition(":")
    challenge = challenge or expected  # (a record from before challenge ids)
    tries_key, used_key = _challenge_keys(phone, scope, challenge)
    if _burned(phone, scope, challenge):
        return None
    cache.add(tries_key, 0, CODE_TTL)
    if cache.incr(tries_key) > MAX_ATTEMPTS:
        _burn(phone, scope, challenge)
        return None
    given = "".join(str(int(ch)) for ch in str(code or "") if ch.isdecimal())
    if not hmac.compare_digest(expected, _digest(phone, given, scope)):
        return None
    # Single use: only the first request to mark THIS challenge used goes on (atomic add), however
    # its check interleaves with others or with a resend.
    if not cache.add(used_key, 1, CODE_TTL):
        return None
    # (the code's entry is left to expire: removing it here could remove a newer code)
    return who(phone)


def _mask(phone):
    return f"{phone[:3]}***{phone[-4:]}" if phone else ""


SEND_MESSAGES = {
    "sent": ("info", "اگر این شماره مجاز باشد، کد ورود پیامک شد."),
    "wait": ("error", "کمی صبر کنید؛ هر دقیقه فقط یک کد فرستاده می‌شود."),
    "limit": ("error", "تعداد درخواست کد در این ساعت زیاد بوده است؛ بعداً دوباره تلاش کنید."),
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
