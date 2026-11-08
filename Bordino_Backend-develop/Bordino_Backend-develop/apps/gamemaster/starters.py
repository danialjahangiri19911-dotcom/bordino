"""The four starting points of a new game. Each is a complete, valid definition (tests check it) the
creator then edits: names, places and answers in brackets are theirs to fill in."""

from copy import deepcopy

TEMPLATES = {
    "birthday": {
        "category": "personal",
        "name": "تولد معمایی",
        "summary": "چند سرنخ کوچک که آخرش به هدیهٔ تولد می‌رسد.",
        "icon": "gift",
        "definition": {
            "title": "یک معما برای تولدت",
            "summary": "سرنخ‌ها را دنبال کن تا به هدیه‌ات برسی.",
            "story": "امروز روز توست! چند سرنخ برایت گذاشته‌ام؛ هر کدام را که حل کنی، بعدی باز می‌شود.",
            "access": "private",
            "finish_points": 0,
            "budget_points": 0,
            "completion_message": "تولدت مبارک! هدیه‌ات همان‌جاست که آخرین سرنخ گفت.",
            "stages": [
                {"id": "s1", "type": "question", "title": "خاطرهٔ اول", "text": "اولین بار کجا همدیگر را دیدیم؟",
                 "question": "اسم آن جا چه بود؟", "answers": ["(جواب را اینجا بنویسید)"], "hints": ["یک کافه بود…"], "points": 0},
                {"id": "s2", "type": "choice", "title": "یک انتخاب", "text": "کدام را بیشتر از همه دوست داری؟",
                 "question": "کدام؟", "options": ["کتاب", "گل", "شکلات"], "answers": ["گل"], "points": 0},
                {"id": "s3", "type": "media", "title": "یک پیام", "text": "این را از ته دل نوشتم… (پیام خودتان را بنویسید)", "points": 0},
                {"id": "s4", "type": "reward", "title": "هدیه", "text": "هدیه‌ات در (جای هدیه) منتظر توست.", "coupon": "", "points": 0},
            ],
        },
    },
    "store_qr": {
        "category": "business",
        "name": "چالش QR فروشگاه",
        "summary": "بازیکن معما را حل می‌کند، به فروشگاه می‌آید و QR را اسکن می‌کند.",
        "icon": "qr-code",
        "definition": {
            "title": "راز فروشگاه ما",
            "summary": "یک معمای کوتاه و یک هدیه در فروشگاه.",
            "story": "در این محله یک فروشگاه هست که رازی دارد. سرنخ را حل کن و خودت را برسان.",
            "access": "public",
            "finish_points": 10,
            "budget_points": 3000,
            "capacity": 100,
            "completion_message": "خوش آمدی! کد تخفیفت را به صندوق نشان بده.",
            "stages": [
                {"id": "s1", "type": "question", "title": "سرنخ", "text": "جایی که (توصیف فروشگاه بدون نام)…",
                 "question": "اسم فروشگاه چیست؟", "answers": ["(نام فروشگاه)"], "hints": ["نزدیک (یک نشانی معروف)"], "points": 10},
                {"id": "s2", "type": "qr", "title": "رسیدی؟", "text": "QR کنار صندوق را اسکن کن.",
                 "place": {"name": "(نام فروشگاه)", "address": "(نشانی)", "about": "", "offer": "۱۰٪ تخفیف با نشان دادن همین صفحه"},
                 "points": 10, "coupon": "(کد تخفیف)"},
            ],
        },
    },
    "city_hunt": {
        "category": "pro",
        "name": "گنج‌یابی شهری",
        "summary": "چند جای دیدنی شهر؛ هر کدام با موقعیت گوشی یا QR تأیید می‌شود.",
        "icon": "map-pin",
        "definition": {
            "title": "گنج‌یابی در (محله)",
            "summary": "سه جای دیدنی، سه سرنخ.",
            "story": "نقشهٔ قدیمی پیدا شده؛ سه جا رویش علامت خورده. پیدایشان کن.",
            "area": "(محله یا خیابان)",
            "duration_minutes": 90,
            "access": "public",
            "finish_points": 30,
            "budget_points": 9000,
            "capacity": 100,
            "completion_message": "گنج را پیدا کردی! شهر را بهتر می‌شناسی.",
            "stages": [
                {"id": "s1", "type": "location", "title": "جای اول", "text": "(سرنخ بدون نام محل)",
                 "lat": 35.6997, "lng": 51.338, "radius_m": 120, "place": {"name": "(نام محل)", "address": "", "about": ""},
                 "hints": ["(اشارهٔ کوچک)", "(اشارهٔ بزرگ‌تر)"], "points": 20},
                {"id": "s2", "type": "question", "title": "جای دوم", "text": "(سرنخ)", "question": "(پرسشی که جوابش در محل است)",
                 "answers": ["(جواب)"], "check_location": True, "lat": 35.7, "lng": 51.34, "radius_m": 120,
                 "place": {"name": "(نام محل)", "address": "", "about": ""}, "points": 20},
                {"id": "s3", "type": "qr", "title": "جای سوم", "text": "(سرنخ)", "place": {"name": "(نام محل)", "address": "", "about": ""}, "points": 20},
            ],
        },
    },
    "quiz": {
        "category": "pro",
        "name": "مسابقهٔ چندمرحله‌ای",
        "summary": "چند پرسش پشت سر هم؛ هر جواب درست امتیاز دارد.",
        "icon": "list",
        "definition": {
            "title": "مسابقهٔ (موضوع)",
            "summary": "پنج پرسش، یک برنده: تو!",
            "story": "آماده‌ای؟ هر جواب درست پرسش بعدی را باز می‌کند.",
            "access": "public",
            "finish_points": 10,
            "hint_penalty": 50,
            "budget_points": 4000,
            "capacity": 100,
            "completion_message": "آفرین! همهٔ پرسش‌ها را جواب دادی.",
            "stages": [
                {"id": "s1", "type": "choice", "title": "پرسش ۱", "text": "", "question": "(پرسش)", "options": ["الف", "ب", "ج"], "answers": ["الف"], "points": 5},
                {"id": "s2", "type": "choice", "title": "پرسش ۲", "text": "", "question": "(پرسش)", "options": ["الف", "ب", "ج"], "answers": ["ب"], "points": 5},
                {"id": "s3", "type": "question", "title": "پرسش ۳", "text": "", "question": "(پرسش با جواب عددی)", "answers": ["1404"], "answer_type": "number", "points": 10},
                {"id": "s4", "type": "puzzle", "title": "معما", "text": "(معما)", "question": "جواب معما؟", "answers": ["(جواب)"], "hints": ["(اشاره)"], "points": 10, "time_limit_s": 120},
            ],
        },
    },
}


def listing() -> list[dict]:
    return [
        {"id": key, "category": t["category"], "name": t["name"], "summary": t["summary"], "icon": t["icon"], "stages": len(t["definition"]["stages"])}
        for key, t in TEMPLATES.items()
    ]


def definition(key: str) -> dict | None:
    template = TEMPLATES.get(key)
    return deepcopy(template["definition"]) if template else None
