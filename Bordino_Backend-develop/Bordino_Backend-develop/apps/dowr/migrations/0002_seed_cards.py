"""The design's 120 cards in six topics (Bordino-Dowr-Game-Design v1.6, source/decks.js), and the settings
row: what the game starts with; Bordino edits them in the admin afterwards."""

from django.db import migrations

SEED = {
 "categories": [
  {
   "id": "daily",
   "label": "زندگی روزمره",
   "icon": "coffee"
  },
  {
   "id": "food",
   "label": "خوشمزه‌ها",
   "icon": "utensils"
  },
  {
   "id": "nature",
   "label": "حیوانات و طبیعت",
   "icon": "leaf"
  },
  {
   "id": "jobs",
   "label": "شغل و مهارت",
   "icon": "briefcase"
  },
  {
   "id": "fun",
   "label": "ورزش و سرگرمی",
   "icon": "gamepad-2"
  },
  {
   "id": "travel",
   "label": "سفر و شهر",
   "icon": "map-pin"
  }
 ],
 "cards": [
  {
   "category": "daily",
   "difficulty": 1,
   "text": "مسواک",
   "forbidden": [
    "دندان",
    "خمیر",
    "دهان"
   ]
  },
  {
   "category": "daily",
   "difficulty": 1,
   "text": "چتر",
   "forbidden": [
    "باران",
    "خیس",
    "باز"
   ]
  },
  {
   "category": "daily",
   "difficulty": 1,
   "text": "کلید",
   "forbidden": [
    "قفل",
    "در",
    "باز"
   ]
  },
  {
   "category": "daily",
   "difficulty": 1,
   "text": "بالش",
   "forbidden": [
    "خواب",
    "سر",
    "تخت"
   ]
  },
  {
   "category": "daily",
   "difficulty": 1,
   "text": "آینه",
   "forbidden": [
    "تصویر",
    "صورت",
    "انعکاس"
   ]
  },
  {
   "category": "daily",
   "difficulty": 1,
   "text": "ساعت",
   "forbidden": [
    "زمان",
    "عقربه",
    "دقیقه"
   ]
  },
  {
   "category": "daily",
   "difficulty": 1,
   "text": "یخچال",
   "forbidden": [
    "سرد",
    "غذا",
    "آشپزخانه"
   ]
  },
  {
   "category": "daily",
   "difficulty": 1,
   "text": "جاروبرقی",
   "forbidden": [
    "گرد",
    "خاک",
    "تمیز"
   ]
  },
  {
   "category": "daily",
   "difficulty": 1,
   "text": "قیچی",
   "forbidden": [
    "بریدن",
    "کاغذ",
    "تیغه"
   ]
  },
  {
   "category": "daily",
   "difficulty": 1,
   "text": "چراغ",
   "forbidden": [
    "نور",
    "روشن",
    "تاریک"
   ]
  },
  {
   "category": "daily",
   "difficulty": 2,
   "text": "آسانسور",
   "forbidden": [
    "طبقه",
    "بالا",
    "ساختمان"
   ]
  },
  {
   "category": "daily",
   "difficulty": 2,
   "text": "ماشین لباسشویی",
   "forbidden": [
    "لباس",
    "شستن",
    "کثیف"
   ]
  },
  {
   "category": "daily",
   "difficulty": 2,
   "text": "کنترل تلویزیون",
   "forbidden": [
    "کانال",
    "دکمه",
    "تماشا"
   ]
  },
  {
   "category": "daily",
   "difficulty": 2,
   "text": "چراغ راهنمایی",
   "forbidden": [
    "قرمز",
    "سبز",
    "خیابان"
   ]
  },
  {
   "category": "daily",
   "difficulty": 2,
   "text": "شارژر",
   "forbidden": [
    "باتری",
    "گوشی",
    "برق"
   ]
  },
  {
   "category": "daily",
   "difficulty": 2,
   "text": "زنگ در",
   "forbidden": [
    "مهمان",
    "صدا",
    "خانه"
   ]
  },
  {
   "category": "daily",
   "difficulty": 2,
   "text": "کیف پول",
   "forbidden": [
    "اسکناس",
    "کارت",
    "پول"
   ]
  },
  {
   "category": "daily",
   "difficulty": 2,
   "text": "عینک آفتابی",
   "forbidden": [
    "چشم",
    "خورشید",
    "تیره"
   ]
  },
  {
   "category": "daily",
   "difficulty": 2,
   "text": "صندوق پست",
   "forbidden": [
    "نامه",
    "پاکت",
    "ارسال"
   ]
  },
  {
   "category": "daily",
   "difficulty": 2,
   "text": "نردبان",
   "forbidden": [
    "پله",
    "بالا",
    "ارتفاع"
   ]
  },
  {
   "category": "food",
   "difficulty": 1,
   "text": "پیتزا",
   "forbidden": [
    "پنیر",
    "خمیر",
    "ایتالیا"
   ]
  },
  {
   "category": "food",
   "difficulty": 1,
   "text": "بستنی",
   "forbidden": [
    "سرد",
    "قیفی",
    "شیرین"
   ]
  },
  {
   "category": "food",
   "difficulty": 1,
   "text": "هندوانه",
   "forbidden": [
    "قرمز",
    "تابستان",
    "تخمه"
   ]
  },
  {
   "category": "food",
   "difficulty": 1,
   "text": "چای",
   "forbidden": [
    "استکان",
    "دم",
    "قوری"
   ]
  },
  {
   "category": "food",
   "difficulty": 1,
   "text": "قهوه",
   "forbidden": [
    "کافئین",
    "تلخ",
    "فنجان"
   ]
  },
  {
   "category": "food",
   "difficulty": 1,
   "text": "نان",
   "forbidden": [
    "نانوایی",
    "آرد",
    "تنور"
   ]
  },
  {
   "category": "food",
   "difficulty": 1,
   "text": "عسل",
   "forbidden": [
    "زنبور",
    "شیرین",
    "کندو"
   ]
  },
  {
   "category": "food",
   "difficulty": 1,
   "text": "پنیر",
   "forbidden": [
    "صبحانه",
    "شیر",
    "سفید"
   ]
  },
  {
   "category": "food",
   "difficulty": 1,
   "text": "خیار",
   "forbidden": [
    "سبز",
    "سالاد",
    "شور"
   ]
  },
  {
   "category": "food",
   "difficulty": 1,
   "text": "شکلات",
   "forbidden": [
    "کاکائو",
    "شیرین",
    "قهوه‌ای"
   ]
  },
  {
   "category": "food",
   "difficulty": 2,
   "text": "قرمه‌سبزی",
   "forbidden": [
    "خورشت",
    "لوبیا",
    "لیمو"
   ]
  },
  {
   "category": "food",
   "difficulty": 2,
   "text": "ته‌دیگ",
   "forbidden": [
    "برنج",
    "قابلمه",
    "برشته"
   ]
  },
  {
   "category": "food",
   "difficulty": 2,
   "text": "کشک بادمجان",
   "forbidden": [
    "کشک",
    "بادمجان",
    "نعناع"
   ]
  },
  {
   "category": "food",
   "difficulty": 2,
   "text": "آش رشته",
   "forbidden": [
    "حبوبات",
    "کشک",
    "رشته"
   ]
  },
  {
   "category": "food",
   "difficulty": 2,
   "text": "زولبیا",
   "forbidden": [
    "رمضان",
    "شربت",
    "بامیه"
   ]
  },
  {
   "category": "food",
   "difficulty": 2,
   "text": "سالاد شیرازی",
   "forbidden": [
    "خیار",
    "گوجه",
    "پیاز"
   ]
  },
  {
   "category": "food",
   "difficulty": 2,
   "text": "پشمک",
   "forbidden": [
    "پنبه",
    "شیرین",
    "نخ"
   ]
  },
  {
   "category": "food",
   "difficulty": 2,
   "text": "ذرت بوداده",
   "forbidden": [
    "سینما",
    "ذرت",
    "پف"
   ]
  },
  {
   "category": "food",
   "difficulty": 2,
   "text": "دلمه",
   "forbidden": [
    "برگ",
    "مو",
    "برنج"
   ]
  },
  {
   "category": "food",
   "difficulty": 2,
   "text": "نبات",
   "forbidden": [
    "چای",
    "بلور",
    "شیرین"
   ]
  },
  {
   "category": "nature",
   "difficulty": 1,
   "text": "فیل",
   "forbidden": [
    "خرطوم",
    "گوش",
    "بزرگ"
   ]
  },
  {
   "category": "nature",
   "difficulty": 1,
   "text": "زرافه",
   "forbidden": [
    "گردن",
    "بلند",
    "خال"
   ]
  },
  {
   "category": "nature",
   "difficulty": 1,
   "text": "پنگوئن",
   "forbidden": [
    "قطب",
    "پرنده",
    "یخ"
   ]
  },
  {
   "category": "nature",
   "difficulty": 1,
   "text": "پروانه",
   "forbidden": [
    "بال",
    "پیله",
    "رنگی"
   ]
  },
  {
   "category": "nature",
   "difficulty": 1,
   "text": "لاک‌پشت",
   "forbidden": [
    "لاک",
    "آرام",
    "خزنده"
   ]
  },
  {
   "category": "nature",
   "difficulty": 1,
   "text": "دلفین",
   "forbidden": [
    "دریا",
    "باهوش",
    "شنا"
   ]
  },
  {
   "category": "nature",
   "difficulty": 1,
   "text": "زنبور",
   "forbidden": [
    "عسل",
    "نیش",
    "کندو"
   ]
  },
  {
   "category": "nature",
   "difficulty": 1,
   "text": "جغد",
   "forbidden": [
    "شب",
    "پرنده",
    "چشم"
   ]
  },
  {
   "category": "nature",
   "difficulty": 1,
   "text": "کوه",
   "forbidden": [
    "قله",
    "سنگ",
    "بلند"
   ]
  },
  {
   "category": "nature",
   "difficulty": 1,
   "text": "رودخانه",
   "forbidden": [
    "آب",
    "جریان",
    "پل"
   ]
  },
  {
   "category": "nature",
   "difficulty": 2,
   "text": "رنگین‌کمان",
   "forbidden": [
    "باران",
    "رنگ",
    "آسمان"
   ]
  },
  {
   "category": "nature",
   "difficulty": 2,
   "text": "آتشفشان",
   "forbidden": [
    "گدازه",
    "کوه",
    "فوران"
   ]
  },
  {
   "category": "nature",
   "difficulty": 2,
   "text": "آفتاب‌پرست",
   "forbidden": [
    "رنگ",
    "مارمولک",
    "تغییر"
   ]
  },
  {
   "category": "nature",
   "difficulty": 2,
   "text": "اختاپوس",
   "forbidden": [
    "هشت",
    "دریا",
    "بازو"
   ]
  },
  {
   "category": "nature",
   "difficulty": 2,
   "text": "قاصدک",
   "forbidden": [
    "فوت",
    "دانه",
    "پرواز"
   ]
  },
  {
   "category": "nature",
   "difficulty": 2,
   "text": "شهاب‌سنگ",
   "forbidden": [
    "فضا",
    "آسمان",
    "سقوط"
   ]
  },
  {
   "category": "nature",
   "difficulty": 2,
   "text": "جزر و مد",
   "forbidden": [
    "دریا",
    "ماه",
    "بالا"
   ]
  },
  {
   "category": "nature",
   "difficulty": 2,
   "text": "کاکتوس",
   "forbidden": [
    "تیغ",
    "بیابان",
    "گیاه"
   ]
  },
  {
   "category": "nature",
   "difficulty": 2,
   "text": "آبشار",
   "forbidden": [
    "آب",
    "سقوط",
    "بلند"
   ]
  },
  {
   "category": "nature",
   "difficulty": 2,
   "text": "مهتاب",
   "forbidden": [
    "ماه",
    "شب",
    "نور"
   ]
  },
  {
   "category": "jobs",
   "difficulty": 1,
   "text": "پزشک",
   "forbidden": [
    "بیمار",
    "درمان",
    "نسخه"
   ]
  },
  {
   "category": "jobs",
   "difficulty": 1,
   "text": "معلم",
   "forbidden": [
    "مدرسه",
    "درس",
    "دانش‌آموز"
   ]
  },
  {
   "category": "jobs",
   "difficulty": 1,
   "text": "خلبان",
   "forbidden": [
    "هواپیما",
    "پرواز",
    "آسمان"
   ]
  },
  {
   "category": "jobs",
   "difficulty": 1,
   "text": "آشپز",
   "forbidden": [
    "غذا",
    "پختن",
    "رستوران"
   ]
  },
  {
   "category": "jobs",
   "difficulty": 1,
   "text": "نجار",
   "forbidden": [
    "چوب",
    "اره",
    "مبل"
   ]
  },
  {
   "category": "jobs",
   "difficulty": 1,
   "text": "نقاش",
   "forbidden": [
    "رنگ",
    "بوم",
    "قلم‌مو"
   ]
  },
  {
   "category": "jobs",
   "difficulty": 1,
   "text": "آتش‌نشان",
   "forbidden": [
    "آتش",
    "شیلنگ",
    "خاموش"
   ]
  },
  {
   "category": "jobs",
   "difficulty": 1,
   "text": "راننده",
   "forbidden": [
    "ماشین",
    "فرمان",
    "جاده"
   ]
  },
  {
   "category": "jobs",
   "difficulty": 1,
   "text": "عکاس",
   "forbidden": [
    "دوربین",
    "تصویر",
    "عکس"
   ]
  },
  {
   "category": "jobs",
   "difficulty": 1,
   "text": "باغبان",
   "forbidden": [
    "گل",
    "باغ",
    "آبیاری"
   ]
  },
  {
   "category": "jobs",
   "difficulty": 2,
   "text": "باستان‌شناس",
   "forbidden": [
    "تاریخ",
    "حفاری",
    "قدیمی"
   ]
  },
  {
   "category": "jobs",
   "difficulty": 2,
   "text": "فضانورد",
   "forbidden": [
    "موشک",
    "فضا",
    "ماه"
   ]
  },
  {
   "category": "jobs",
   "difficulty": 2,
   "text": "دامپزشک",
   "forbidden": [
    "حیوان",
    "درمان",
    "پزشک"
   ]
  },
  {
   "category": "jobs",
   "difficulty": 2,
   "text": "هواشناس",
   "forbidden": [
    "باران",
    "هوا",
    "پیش‌بینی"
   ]
  },
  {
   "category": "jobs",
   "difficulty": 2,
   "text": "مترجم",
   "forbidden": [
    "زبان",
    "متن",
    "معنی"
   ]
  },
  {
   "category": "jobs",
   "difficulty": 2,
   "text": "کارآگاه",
   "forbidden": [
    "معما",
    "جرم",
    "سرنخ"
   ]
  },
  {
   "category": "jobs",
   "difficulty": 2,
   "text": "برنامه‌نویس",
   "forbidden": [
    "کد",
    "رایانه",
    "نرم‌افزار"
   ]
  },
  {
   "category": "jobs",
   "difficulty": 2,
   "text": "معمار",
   "forbidden": [
    "ساختمان",
    "نقشه",
    "طراحی"
   ]
  },
  {
   "category": "jobs",
   "difficulty": 2,
   "text": "داور",
   "forbidden": [
    "سوت",
    "قانون",
    "مسابقه"
   ]
  },
  {
   "category": "jobs",
   "difficulty": 2,
   "text": "گوینده",
   "forbidden": [
    "صدا",
    "رادیو",
    "میکروفن"
   ]
  },
  {
   "category": "fun",
   "difficulty": 1,
   "text": "فوتبال",
   "forbidden": [
    "توپ",
    "گل",
    "دروازه"
   ]
  },
  {
   "category": "fun",
   "difficulty": 1,
   "text": "شطرنج",
   "forbidden": [
    "شاه",
    "مهره",
    "مات"
   ]
  },
  {
   "category": "fun",
   "difficulty": 1,
   "text": "شنا",
   "forbidden": [
    "آب",
    "استخر",
    "ماهی"
   ]
  },
  {
   "category": "fun",
   "difficulty": 1,
   "text": "دوچرخه",
   "forbidden": [
    "رکاب",
    "چرخ",
    "زین"
   ]
  },
  {
   "category": "fun",
   "difficulty": 1,
   "text": "گیتار",
   "forbidden": [
    "ساز",
    "سیم",
    "موسیقی"
   ]
  },
  {
   "category": "fun",
   "difficulty": 1,
   "text": "سینما",
   "forbidden": [
    "فیلم",
    "پرده",
    "تماشا"
   ]
  },
  {
   "category": "fun",
   "difficulty": 1,
   "text": "کتاب",
   "forbidden": [
    "صفحه",
    "خواندن",
    "نویسنده"
   ]
  },
  {
   "category": "fun",
   "difficulty": 1,
   "text": "نقاشی",
   "forbidden": [
    "رنگ",
    "کاغذ",
    "کشیدن"
   ]
  },
  {
   "category": "fun",
   "difficulty": 1,
   "text": "والیبال",
   "forbidden": [
    "تور",
    "توپ",
    "دست"
   ]
  },
  {
   "category": "fun",
   "difficulty": 1,
   "text": "تنیس",
   "forbidden": [
    "راکت",
    "توپ",
    "زمین"
   ]
  },
  {
   "category": "fun",
   "difficulty": 2,
   "text": "کوهنوردی",
   "forbidden": [
    "قله",
    "کوه",
    "صعود"
   ]
  },
  {
   "category": "fun",
   "difficulty": 2,
   "text": "اسکی",
   "forbidden": [
    "برف",
    "چوب",
    "سرازیری"
   ]
  },
  {
   "category": "fun",
   "difficulty": 2,
   "text": "غواصی",
   "forbidden": [
    "دریا",
    "ماسک",
    "اکسیژن"
   ]
  },
  {
   "category": "fun",
   "difficulty": 2,
   "text": "بولینگ",
   "forbidden": [
    "توپ",
    "میله",
    "سالن"
   ]
  },
  {
   "category": "fun",
   "difficulty": 2,
   "text": "طناب‌کشی",
   "forbidden": [
    "طناب",
    "کشیدن",
    "تیم"
   ]
  },
  {
   "category": "fun",
   "difficulty": 2,
   "text": "بادبادک",
   "forbidden": [
    "باد",
    "نخ",
    "پرواز"
   ]
  },
  {
   "category": "fun",
   "difficulty": 2,
   "text": "تردستی",
   "forbidden": [
    "شعبده",
    "جادو",
    "دست"
   ]
  },
  {
   "category": "fun",
   "difficulty": 2,
   "text": "نمایش عروسکی",
   "forbidden": [
    "عروسک",
    "صحنه",
    "نخ"
   ]
  },
  {
   "category": "fun",
   "difficulty": 2,
   "text": "حل جدول",
   "forbidden": [
    "کلمه",
    "خانه",
    "روزنامه"
   ]
  },
  {
   "category": "fun",
   "difficulty": 2,
   "text": "پازل",
   "forbidden": [
    "تکه",
    "تصویر",
    "چیدن"
   ]
  },
  {
   "category": "travel",
   "difficulty": 1,
   "text": "قطار",
   "forbidden": [
    "ریل",
    "واگن",
    "ایستگاه"
   ]
  },
  {
   "category": "travel",
   "difficulty": 1,
   "text": "هواپیما",
   "forbidden": [
    "پرواز",
    "بال",
    "فرودگاه"
   ]
  },
  {
   "category": "travel",
   "difficulty": 1,
   "text": "کشتی",
   "forbidden": [
    "دریا",
    "بندر",
    "کاپیتان"
   ]
  },
  {
   "category": "travel",
   "difficulty": 1,
   "text": "اتوبوس",
   "forbidden": [
    "مسافر",
    "ایستگاه",
    "راننده"
   ]
  },
  {
   "category": "travel",
   "difficulty": 1,
   "text": "چمدان",
   "forbidden": [
    "سفر",
    "لباس",
    "دسته"
   ]
  },
  {
   "category": "travel",
   "difficulty": 1,
   "text": "هتل",
   "forbidden": [
    "اتاق",
    "اقامت",
    "مسافر"
   ]
  },
  {
   "category": "travel",
   "difficulty": 1,
   "text": "پل",
   "forbidden": [
    "رودخانه",
    "عبور",
    "دوطرف"
   ]
  },
  {
   "category": "travel",
   "difficulty": 1,
   "text": "پارک",
   "forbidden": [
    "درخت",
    "نیمکت",
    "بازی"
   ]
  },
  {
   "category": "travel",
   "difficulty": 1,
   "text": "موزه",
   "forbidden": [
    "قدیمی",
    "تاریخ",
    "آثار"
   ]
  },
  {
   "category": "travel",
   "difficulty": 1,
   "text": "بازار",
   "forbidden": [
    "خرید",
    "مغازه",
    "فروش"
   ]
  },
  {
   "category": "travel",
   "difficulty": 2,
   "text": "گذرنامه",
   "forbidden": [
    "کشور",
    "سفر",
    "مرز"
   ]
  },
  {
   "category": "travel",
   "difficulty": 2,
   "text": "مترو",
   "forbidden": [
    "زیرزمین",
    "قطار",
    "ایستگاه"
   ]
  },
  {
   "category": "travel",
   "difficulty": 2,
   "text": "کوله‌پشتی",
   "forbidden": [
    "پشت",
    "کیف",
    "سفر"
   ]
  },
  {
   "category": "travel",
   "difficulty": 2,
   "text": "فانوس دریایی",
   "forbidden": [
    "نور",
    "کشتی",
    "ساحل"
   ]
  },
  {
   "category": "travel",
   "difficulty": 2,
   "text": "تله‌کابین",
   "forbidden": [
    "کابل",
    "کوه",
    "کابین"
   ]
  },
  {
   "category": "travel",
   "difficulty": 2,
   "text": "کمربند ایمنی",
   "forbidden": [
    "تصادف",
    "صندلی",
    "ماشین"
   ]
  },
  {
   "category": "travel",
   "difficulty": 2,
   "text": "قطب‌نما",
   "forbidden": [
    "شمال",
    "جهت",
    "عقربه"
   ]
  },
  {
   "category": "travel",
   "difficulty": 2,
   "text": "نقشه",
   "forbidden": [
    "مسیر",
    "شهر",
    "جغرافیا"
   ]
  },
  {
   "category": "travel",
   "difficulty": 2,
   "text": "بلیت",
   "forbidden": [
    "ورود",
    "خرید",
    "سفر"
   ]
  },
  {
   "category": "travel",
   "difficulty": 2,
   "text": "سوغاتی",
   "forbidden": [
    "هدیه",
    "سفر",
    "یادگاری"
   ]
  }
 ]
}


def forwards(apps, schema_editor):
    Settings = apps.get_model("dowr", "DowrSettings")
    Category = apps.get_model("dowr", "DowrCategory")
    Card = apps.get_model("dowr", "DowrCard")
    if not Settings.objects.exists():
        Settings.objects.create()
    for order, c in enumerate(SEED["categories"]):
        cat, _ = Category.objects.get_or_create(slug=c["id"], defaults={"name": c["label"], "icon": c["icon"], "order": order})
        for card in (x for x in SEED["cards"] if x["category"] == c["id"]):
            Card.objects.get_or_create(category=cat, text=card["text"], defaults={"difficulty": card["difficulty"], "forbidden": "،".join(card["forbidden"])})


def backwards(apps, schema_editor):
    apps.get_model("dowr", "DowrCard").objects.all().delete()
    apps.get_model("dowr", "DowrCategory").objects.all().delete()
    apps.get_model("dowr", "DowrSettings").objects.all().delete()


class Migration(migrations.Migration):
    dependencies = [("dowr", "0001_initial")]

    operations = [migrations.RunPython(forwards, backwards)]
