"""The settings «بردینو ادمین» can change: each key the code reads through SystemConfiguration, with
a Persian name, what it does, its type and limits, and the code's own default. A value is stored as
a SystemConfiguration row (the admin's «System configurations» too); removing the row brings back
the default (or the server's environment variable of the same name)."""

import os

from apps.configuration.models.system_configuration import SystemConfiguration
from apps.coins.services import DEFAULTS as COIN
from apps.gamemaster.services import DEFAULTS as GM
from apps.wallet.services.ad_reward import DEFAULTS as AD

GROUPS = {
    "gm": "گیم مستر (بازی‌های سازندگان)",
    "ads": "تبلیغ و جایزه",
    "coins": "سکه و خرید سکه",
    "wallet": "کیف پول",
    "files": "فایل‌ها",
}


def _e(key, group, kind, label, help_text="", default=None, lo=None, hi=None, choices=None):
    return {"key": key, "group": group, "type": kind, "label": label, "help": help_text, "default": default, "min": lo, "max": hi, "choices": choices}


CATALOG = [
    # Game Master
    _e("GM_ACCESS", "gm", "choice", "چه کسانی گیم مستر را ببینند", "خاموش: هیچ‌کس · کارکنان: فقط کارکنان بردینو · همه: همهٔ کاربران.", GM["GM_ACCESS"], choices=[["off", "خاموش"], ["staff", "کارکنان"], ["all", "همه"]]),
    _e("GM_FEE_BUSINESS_TOMAN", "gm", "int", "هزینهٔ انتشار بازی کسب‌وکار (تومان)", "۰ = رایگان. بعد از تأیید، قبل از انتشار گرفته می‌شود.", GM["GM_FEE_BUSINESS_TOMAN"], 0, 100_000_000),
    _e("GM_FEE_PERSONAL_TOMAN", "gm", "int", "هزینهٔ انتشار بازی شخصی (تومان)", "", GM["GM_FEE_PERSONAL_TOMAN"], 0, 100_000_000),
    _e("GM_FEE_PRO_TOMAN", "gm", "int", "هزینهٔ انتشار بازی حرفه‌ای (تومان)", "", GM["GM_FEE_PRO_TOMAN"], 0, 100_000_000),
    _e("GM_INCLUDED_STAGES", "gm", "int", "مرحله‌های داخل هزینهٔ پایه", "بیشتر از این تعداد، هر مرحله هزینهٔ اضافه دارد.", GM["GM_INCLUDED_STAGES"], 1, 20),
    _e("GM_EXTRA_STAGE_TOMAN", "gm", "int", "هزینهٔ هر مرحلهٔ اضافه (تومان)", "", GM["GM_EXTRA_STAGE_TOMAN"], 0, 10_000_000),
    _e("GM_ZIBAL_MODE", "gm", "choice", "درگاه پرداخت زیبال", "آزمایشی: پولی جابه‌جا نمی‌شود · تست زیبال · واقعی (نیاز به مرچنت).", GM["GM_ZIBAL_MODE"], choices=[["sandbox", "آزمایشی"], ["test", "تست زیبال"], ["live", "واقعی"]]),
    _e("GM_ZIBAL_MERCHANT", "gm", "str", "کد مرچنت زیبال", "فقط برای حالت واقعی.", GM["GM_ZIBAL_MERCHANT"]),
    _e("GM_SMS_ENABLED", "gm", "bool", "پیامک‌های گیم مستر", "پیامک تأیید، اصلاح و انتشار به سازنده (قالب‌ها باید در کاوه‌نگار تأیید شده باشند).", GM["GM_SMS_ENABLED"]),
    _e("GM_MAX_OPEN_GAMES", "gm", "int", "سقف بازی‌های باز هر سازنده", "", GM["GM_MAX_OPEN_GAMES"], 1, 1000),
    _e("GM_MAX_UPLOADS_PER_DAY", "gm", "int", "سقف تصویر در روز برای هر سازنده", "", GM["GM_MAX_UPLOADS_PER_DAY"], 1, 10_000),
    _e("GM_MAX_UPLOADS_TOTAL", "gm", "int", "سقف کل تصویرهای هر سازنده", "", GM["GM_MAX_UPLOADS_TOTAL"], 1, 100_000),
    _e("GM_EXPIRY_DAYS_PERSONAL", "gm", "int", "مدت پیش‌فرض بازی شخصی (روز)", "۰ = بدون پایان خودکار.", GM["GM_EXPIRY_DAYS_PERSONAL"], 0, 3650),
    _e("GM_EXPIRY_DAYS_BUSINESS", "gm", "int", "مدت پیش‌فرض بازی کسب‌وکار (روز)", "۰ = بدون پایان خودکار.", GM["GM_EXPIRY_DAYS_BUSINESS"], 0, 3650),
    _e("GM_EXPIRY_DAYS_PRO", "gm", "int", "مدت پیش‌فرض بازی حرفه‌ای (روز)", "۰ = بدون پایان خودکار.", GM["GM_EXPIRY_DAYS_PRO"], 0, 3650),
    _e("GM_EXPIRY_DAYS_COMPETITIVE", "gm", "int", "مدت پیش‌فرض مسابقه (روز)", "", GM["GM_EXPIRY_DAYS_COMPETITIVE"], 0, 3650),
    _e("GM_MAX_DAYS_PERSONAL", "gm", "int", "حداکثر مدت بازی شخصی (روز)", "۰ = بدون سقف.", GM["GM_MAX_DAYS_PERSONAL"], 0, 3650),
    _e("GM_MAX_DAYS_BUSINESS", "gm", "int", "حداکثر مدت بازی کسب‌وکار (روز)", "۰ = بدون سقف.", GM["GM_MAX_DAYS_BUSINESS"], 0, 3650),
    _e("GM_MAX_DAYS_PRO", "gm", "int", "حداکثر مدت بازی حرفه‌ای (روز)", "۰ = بدون سقف.", GM["GM_MAX_DAYS_PRO"], 0, 3650),
    _e("GM_MAX_GRACE_HOURS", "gm", "int", "حداکثر مهلت تمام کردن بعد از پایان (ساعت)", "", GM["GM_MAX_GRACE_HOURS"], 0, 720),
    _e("GM_LEADERBOARD_CATEGORIES", "gm", "str", "انواع بازی که جدول رده‌بندی دارند", "با ویرگول: business,personal,pro", GM["GM_LEADERBOARD_CATEGORIES"]),
    # Ads & rewards
    _e("AD_REWARD_ENABLED", "ads", "bool", "جایزهٔ دیدن تبلیغ", "", AD["AD_REWARD_ENABLED"]),
    _e("AD_REWARD_PROVIDER", "ads", "choice", "تبلیغ‌دهنده", "", AD["AD_REWARD_PROVIDER"], choices=[["demo", "نمایشی (ویدئوی خودمان)"], ["adivery", "ادیوری"]]),
    _e("AD_REWARD_POINTS", "ads", "int", "امتیاز هر تبلیغ", "", AD["AD_REWARD_POINTS"], 0, 1000),
    _e("AD_REWARD_DAILY_LIMIT", "ads", "int", "سقف تبلیغ جایزه‌دار در روز", "", AD["AD_REWARD_DAILY_LIMIT"], 0, 100),
    _e("AD_DEMO_SECONDS", "ads", "int", "مدت تبلیغ نمایشی (ثانیه)", "", AD["AD_DEMO_SECONDS"], 3, 120),
    _e("ADIVERY_TRUST_APP", "ads", "bool", "پذیرفتن «دیدم» از خود اپ (ادیوری)", "تا وقتی ادیوری به سرور خبر نمی‌دهد.", AD["ADIVERY_TRUST_APP"]),
    _e("ADIVERY_TRUST_SECONDS", "ads", "int", "حداقل ثانیه برای پذیرفتن «دیدم»", "", AD["ADIVERY_TRUST_SECONDS"], 1, 20),  # (the app asks again for ~28 s: longer would never pay)
    _e("COMPLETE_PROFILE_REWARD_POINTS", "ads", "int", "امتیاز تکمیل پروفایل", "یک بار برای هر کاربر.", 25, 0, 10_000),
    # Coins
    _e("COIN_ZIBAL_MODE", "coins", "choice", "درگاه خرید سکه", "خاموش: خرید بسته است · آزمایشی: پولی جابه‌جا نمی‌شود اما سکه داده می‌شود · تست زیبال · واقعی (نیاز به مرچنت).", COIN["COIN_ZIBAL_MODE"], choices=[["off", "خاموش"], ["sandbox", "آزمایشی"], ["test", "تست زیبال"], ["live", "واقعی"]]),
    _e("COIN_ZIBAL_MERCHANT", "coins", "str", "کد مرچنت زیبال برای سکه", "خالی = همان مرچنت گیم مستر. فقط برای حالت واقعی.", COIN["COIN_ZIBAL_MERCHANT"]),
    # Wallet
    _e("WALLET_TOKEN_EXPIRATION_DAYS", "wallet", "int", "اعتبار امتیازها (روز)", "", 365, 1, 3650),
    _e("WALLET_CURRENCY_EXPIRATION_DAYS", "wallet", "int", "اعتبار موجودی نقدی (روز)", "", 365, 1, 3650),
    _e("WALLET_MAX_NEGATIVE_POINTS", "wallet", "int", "حداکثر منفی شدن امتیاز", "۰ = هرگز منفی نشود.", 0, 0, 1_000_000),
    _e("WALLET_MAX_NEGATIVE_CURRENCY", "wallet", "int", "حداکثر منفی شدن موجودی نقدی (تومان)", "۰ = هرگز منفی نشود.", 0, 0, 1_000_000_000),
    # Files
    _e("FILE_VALIDATOR_MAX_FILE_SIZE", "files", "int", "حداکثر حجم فایل بارگذاری (بایت)", "", None, 10_000, 50_000_000),
]
BY_KEY = {e["key"]: e for e in CATALOG}
VALUE_TYPE = {"int": "int", "bool": "bool", "str": "str", "choice": "str"}


class SettingError(Exception):
    pass


def parse(entry: dict, raw):
    """The value as stored (a string) and as used, checked against the entry's type and limits."""
    kind = entry["type"]
    if kind == "bool":
        if isinstance(raw, bool):
            value = raw
        elif str(raw).strip().lower() in ("true", "1", "yes", "on"):
            value = True
        elif str(raw).strip().lower() in ("false", "0", "no", "off"):
            value = False
        else:
            raise SettingError("روشن یا خاموش را انتخاب کن.")
        return ("true" if value else "false"), value
    if kind == "int":
        text = str(raw).strip().translate(str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")).replace(",", "").replace("٬", "")
        try:
            value = int(text)
        except ValueError as exc:
            raise SettingError("یک عدد صحیح بنویس.") from exc
        if entry["min"] is not None and value < entry["min"]:
            raise SettingError(f"کمتر از {entry['min']} نمی‌شود.")
        if entry["max"] is not None and value > entry["max"]:
            raise SettingError(f"بیشتر از {entry['max']} نمی‌شود.")
        return str(value), value
    text = str(raw if raw is not None else "").strip()
    if kind == "choice" and text not in {c[0] for c in entry["choices"]}:
        raise SettingError("یکی از گزینه‌ها را انتخاب کن.")
    if len(text) > 500:
        raise SettingError("خیلی طولانی است.")
    return text, text


def code_default(entry: dict):
    """The code's own default (read live from the dicts the code itself uses)."""
    key = entry["key"]
    return GM[key] if key in GM else AD[key] if key in AD else entry["default"]


def current(entry: dict) -> dict:
    entry = {**entry, "default": code_default(entry)}
    row = SystemConfiguration.objects.filter(key=entry["key"]).first()
    raw = (row.value or row.default_value) if row is not None else None
    if raw is not None and str(raw).strip():
        source, value = "database", row.get_typed_value(raw)
    elif os.environ.get(entry["key"], "").strip():
        # (read directly, never through the manager's get(): that would fill the shared cache from
        # inside a transaction that may still roll back)
        source, value = "env", SystemConfiguration.objects._cast_env(os.environ[entry["key"]], entry["default"])  # pylint: disable=protected-access
    else:
        source, value = "default", entry["default"]
    return {**entry, "value": value, "source": source, "updated": row.update_time.isoformat() if row is not None else None}


def put(key: str, raw) -> tuple[dict, object]:
    entry = BY_KEY.get(key)
    if entry is None:
        raise SettingError("این تنظیم شناخته‌شده نیست.")
    before = current(entry)["value"]
    stored, _value = parse(entry, raw)
    # (the SystemConfiguration category of a new row; groups without one leave it empty)
    group = {"gm": None, "ads": None, "coins": None, "wallet": "wallet", "files": "file_upload"}.get(entry["group"])
    row = SystemConfiguration.objects.filter(key=key).first() or SystemConfiguration(key=key)
    row.value = stored
    row.value_type = VALUE_TYPE[entry["type"]]
    row.description = row.description or entry["label"]
    if group and not row.category:
        row.category = group
    row.save()  # (its post_save clears the cache: the new value applies at once)
    return current(entry), before


def reset(key: str) -> tuple[dict, object]:
    entry = BY_KEY.get(key)
    if entry is None:
        raise SettingError("این تنظیم شناخته‌شده نیست.")
    before = current(entry)["value"]
    for row in SystemConfiguration.objects.filter(key=key):
        row.delete()
    SystemConfiguration.objects.invalidate(key)
    return current(entry), before
