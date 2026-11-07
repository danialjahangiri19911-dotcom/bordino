"""Three more «معمای شهری» games (2026-11-07) and the first game's help in levels.

Run with `manage.py shell < make_games2.py` on a database that has missions.0006.
Safe to re-run: a game that already exists (by title) is left alone.
"""

from django.db import transaction

from apps.missions.models import Mystery, MysteryStep

P = MysteryStep.Proof
T = MysteryStep.AnswerType


def make(title, steps, **fields):
    if Mystery.objects.filter(title=title).exists():
        print("exists:", title)
        return None
    with transaction.atomic():
        m = Mystery.objects.create(title=title, **fields)
        for i, s in enumerate(steps, 1):
            MysteryStep.objects.create(mystery=m, order=i, **s)
    total = sum(s.points for s in m.steps.all()) + m.finish_points
    print("made:", title, m.pk, m.steps.count(), "steps", total, "points", "active" if m.is_active else "OFF")
    return m


# ── 1. Text answers: the answer of each riddle is the name of the place you must stand at ──
make(
    "اسم‌های گم‌شدهٔ عباس‌آباد",
    summary="سه معما که جوابشان اسم همان جاست؛ پیاده، حدود یک ساعت",
    story=(
        "روی یک نقشهٔ قدیمی از تپه‌های عباس‌آباد، اسم سه جا پاک شده و به‌جایش سه معما نوشته‌اند.\n\n"
        "هر معما را حل کن: جوابش اسم همان جایی است که باید بروی. به آن‌جا که رسیدی، جواب را بنویس؛ "
        "موقعیت گوشی هم سنجیده می‌شود، پس باید واقعاً آن‌جا باشی."
    ),
    area="عباس‌آباد، کنار بزرگراه مدرس",
    duration_minutes=60,
    finish_points=60,
    steps=[
        dict(
            clue="جایی که دو دشمن قدیمی کنار هم زندگی می‌کنند: یکی شعله می‌کشد، دیگری فواره می‌زند.",
            question="اسم این پارک چیست؟",
            answer_type=T.TEXT, answers="آب و آتش|آتش و آب|آب آتش|پارک آب و آتش|بوستان آب و آتش",
            hints="دو عنصر از چهار عنصر قدیمی.\nشب‌ها ستون‌های شعله‌ورش از دور پیداست.",
            proof=P.ANSWER, check_location=True, latitude="35.754748", longitude="51.418695", radius_m=150, points=20,
            place_name="بوستان آب و آتش",
            place_address="تهران، عباس‌آباد، بزرگراه مدرس",
            place_about="پارکی در عباس‌آباد با ستون‌های آتش و فواره‌های آب، از پاتوق‌های شب‌های تهران. از همین‌جا می‌شود از روی پل به پارک طالقانی رفت.",
        ),
        dict(
            clue="پلی که هیچ ماشینی از رویش نمی‌گذرد؛ از بالای بزرگراه دو باغ را به هم می‌دوزد و طراحش زن جوانی بود. اسمش همان چیزی است که دو طرفش را پوشانده.",
            question="اسم این پل چیست؟",
            answer_type=T.TEXT, answers="طبیعت|پل طبیعت",
            hints="شکلش از شاخه‌های درخت الهام گرفته.\nدو طرفش پارک است: یک طرف همان پارک آتش، طرف دیگر پارک طالقانی.",
            proof=P.ANSWER, check_location=True, latitude="35.754181", longitude="51.419498", radius_m=120, points=20,
            place_name="پل طبیعت",
            place_address="تهران، روی بزرگراه مدرس، میان بوستان آب و آتش و پارک طالقانی",
            place_about="بزرگ‌ترین پل عابر پیادهٔ ایران، با طراحی لیلا عراقیان. از رویش منظرهٔ شمال تهران و رشته‌کوه البرز پیداست.",
        ),
        dict(
            clue="از پل که پایین آمدی به سمت شرق برو: هزاران چیز آن‌جا ورق می‌خورند، ولی هیچ‌کدام برگِ درخت نیستند. اسمش یک جای سبز است و چیزی که می‌خوانی.",
            question="اسم این مجموعه چیست؟",
            answer_type=T.TEXT, answers="باغ کتاب|کتاب|باغ کتاب تهران",
            hints="جای سبز = باغ.\nیکی از بزرگ‌ترین کتاب‌فروشی‌های کشور است.",
            proof=P.ANSWER, check_location=True, latitude="35.752214", longitude="51.431616", radius_m=150, points=20,
            place_name="باغ کتاب تهران",
            place_address="تهران، عباس‌آباد، خیابان شهدای بانک مرکزی",
            place_about="مجموعه‌ای بزرگ برای کتاب و فرهنگ، با کتاب‌فروشی بزرگ و بخش‌های ویژهٔ کودکان؛ برای خستگی‌درکردن بعد از این معما جای خوبی است.",
        ),
    ],
)

# ── 2. Number answers: three famous places along metro line 4, three years ──
make(
    "سال‌شمار تهران",
    summary="سه جای نامدار، سه سال؛ با متروی خط ۴، حدود دو ساعت و نیم",
    story=(
        "سه بنای مشهور تهران هرکدام یک سالِ تولد دارند. معما را بخوان، خودت را به آن‌جا برسان و سالش را "
        "(شمسی) بنویس. موقعیت گوشی هم سنجیده می‌شود.\n\n"
        "مسیر: ایستگاه تئاتر شهر ← ایستگاه انقلاب (پیاده هم می‌شود) ← ایستگاه میدان آزادی، همه روی خط ۴ مترو."
    ),
    area="از چهارراه ولیعصر تا میدان آزادی (متروی خط ۴)",
    duration_minutes=150,
    finish_points=80,
    steps=[
        dict(
            clue="ساختمانی گرد با ستون‌هایی دورتادورش، کنار پارک دانشجو؛ خانهٔ نمایش‌های این شهر.",
            question="این تماشاخانه در چه سالی افتتاح شد؟ (شمسی، چهار رقم)",
            answer_type=T.NUMBER, answers="1351|1972",
            hints="سر چهارراه ولیعصر است و ایستگاه مترویش هم همین اسم را دارد.\nسالش در دههٔ ۱۳۵۰ است.\nیک سال بعد از افتتاح برج آزادی.",
            proof=P.ANSWER, check_location=True, latitude="35.700128", longitude="51.405607", radius_m=120, points=20,
            place_name="تئاتر شهر",
            place_address="تهران، چهارراه ولیعصر، پارک دانشجو",
            place_about="مهم‌ترین تماشاخانهٔ تهران و میزبان جشنوارهٔ تئاتر فجر. ساختمان گردش از نمادهای معماری دههٔ پنجاه است.",
        ),
        dict(
            clue="کمی به سمت غرب: خیابانی که از هر دو طرفش کتاب‌فروشی است، و رو به آن سردرِ قدیمی‌ترین دانشگاه نوین ایران.",
            question="این دانشگاه در چه سالی تأسیس شد؟ (شمسی، چهار رقم)",
            answer_type=T.NUMBER, answers="1313|1934",
            hints="خیابان انقلاب، بین میدان انقلاب و چهارراه ولیعصر.\nحدود ۹۰ سال پیش، در دههٔ ۱۳۱۰.",
            proof=P.ANSWER, check_location=True, latitude="35.701500", longitude="51.395100", radius_m=250, points=20,
            place_name="دانشگاه تهران",
            place_address="تهران، خیابان انقلاب",
            place_about="نخستین دانشگاه نوین ایران. روبه‌رویش، راستهٔ کتاب‌فروشی‌های خیابان انقلاب از معروف‌ترین بازارهای کتاب کشور است.",
        ),
        dict(
            clue="سوار مترو شو و تا آخرِ غربِ خیابان آزادی برو: دروازه‌ای سفید که برای جشن ۲۵۰۰ سالهٔ شاهنشاهی ساخته شد، سرِ راه فرودگاه مهرآباد.",
            question="این برج در چه سالی افتتاح شد؟ (شمسی، چهار رقم)",
            answer_type=T.NUMBER, answers="1350|1971",
            hints="ایستگاه متروی «میدان آزادی».\nپیش از انقلاب «شهیاد» نام داشت.\nهمان سالِ جشن‌های ۲۵۰۰ ساله.",
            proof=P.ANSWER, check_location=True, latitude="35.699738", longitude="51.338061", radius_m=150, points=30,
            place_name="برج آزادی",
            place_address="تهران، میدان آزادی",
            place_about="نماد تهران، با طراحی حسین امانت. زیر برج موزه و نگارخانه هست و از بالایش میدان آزادی و غرب شهر پیداست.",
        ),
    ],
)

# ── 3. QR: a café crawl for partner places — a draft until the cafés are named and the QRs are up ──
make(
    "کافه‌گردی بردینو (پیش‌نویس)",
    summary="سه کافهٔ همکار، سه QR؛ هر کافه یک پیشنهاد ویژه",
    story=(
        "سه کافه، سه سرنخ. در هر کافه یک QR بردینو پیدا کن و اسکنش کن تا سرنخ بعدی باز شود. "
        "هر کافه برای بازیکنان بردینو یک پیشنهاد ویژه دارد."
    ),
    area="(محله را بنویسید)",
    duration_minutes=90,
    finish_points=60,
    is_active=False,
    is_visible=False,
    steps=[
        dict(
            clue="(سرنخ کافهٔ اول: بدون اسم کافه، طوری که پیدا کردنش کمی فکر بخواهد.)",
            hints="(اشارهٔ کوچک)\n(اشارهٔ بزرگ‌تر)",
            proof=P.QR, points=20,
            place_name="کافهٔ همکار ۱ (اسمش را بنویسید)",
            place_offer="(پیشنهاد ویژه، مثلاً ۱۰٪ تخفیف با نشان دادن همین صفحه)",
        ),
        dict(
            clue="(سرنخ کافهٔ دوم)",
            hints="(اشارهٔ کوچک)\n(اشارهٔ بزرگ‌تر)",
            proof=P.QR, points=20,
            place_name="کافهٔ همکار ۲ (اسمش را بنویسید)",
            place_offer="(پیشنهاد ویژه)",
        ),
        dict(
            clue="(سرنخ کافهٔ سوم)",
            hints="(اشارهٔ کوچک)\n(اشارهٔ بزرگ‌تر)",
            proof=P.QR, points=20,
            place_name="کافهٔ همکار ۳ (اسمش را بنویسید)",
            place_offer="(پیشنهاد ویژه)",
        ),
    ],
)

# ── The first game: its one hint becomes a nudge, then the hint it had ──
NUDGES = {
    1: "به اسم خیابان فکر کن: یک روز از تابستان.",
    2: "همسایهٔ همان خیابان است، چند صد متر پایین‌تر.",
    3: "ببین «میدان مشق» قدیم امروز چه اسمی دارد.",
    4: "کاخی قاجاری با اسمی پر از گل.",
    5: "دنبال بزرگ‌ترین بازار سرپوشیدهٔ شهر بگرد.",
}
first = Mystery.objects.filter(title="دفترچهٔ عکاس‌باشی").first()
if first:
    for step in first.steps.all():
        nudge = NUDGES.get(step.order)
        if nudge and not step.hints.startswith(nudge):
            step.hints = f"{nudge}\n{step.hints}".strip()
            step.save()
    print("first game hints:", [len(s.hint_lines()) for s in first.steps.order_by("order")])
