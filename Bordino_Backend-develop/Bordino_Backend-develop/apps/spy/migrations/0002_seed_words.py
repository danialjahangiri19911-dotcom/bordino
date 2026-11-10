"""The design's 14 topics and their sample word pairs (Bordino-Spy-UI-Design 1.0.6, assets/spy-engine.js),
and the settings row: what the game starts with; Bordino grows the word bank in the admin afterwards."""

from django.db import migrations

SEED = [
 {
  "id": "places",
  "label": "مکان‌ها",
  "icon": "map-pin",
  "text": "فرودگاه",
  "related": "ایستگاه قطار",
  "difficulty": 1,
  "age": 7
 },
 {
  "id": "animals",
  "label": "حیوانات",
  "icon": "paw-print",
  "text": "پلنگ",
  "related": "یوزپلنگ",
  "difficulty": 1,
  "age": 7
 },
 {
  "id": "food",
  "label": "خوراکی‌ها",
  "icon": "utensils",
  "text": "بستنی",
  "related": "فالوده",
  "difficulty": 1,
  "age": 7
 },
 {
  "id": "jobs",
  "label": "شغل‌ها",
  "icon": "briefcase-business",
  "text": "خلبان",
  "related": "فضانورد",
  "difficulty": 1,
  "age": 7
 },
 {
  "id": "objects",
  "label": "وسایل",
  "icon": "lamp",
  "text": "چتر",
  "related": "بارانی",
  "difficulty": 1,
  "age": 7
 },
 {
  "id": "movies",
  "label": "فیلم و سریال",
  "icon": "clapperboard",
  "text": "شیرشاه",
  "related": "کتاب جنگل",
  "difficulty": 1,
  "age": 7
 },
 {
  "id": "sports",
  "label": "ورزش",
  "icon": "volleyball",
  "text": "والیبال",
  "related": "بسکتبال",
  "difficulty": 1,
  "age": 7
 },
 {
  "id": "tech",
  "label": "فناوری",
  "icon": "cpu",
  "text": "تبلت",
  "related": "لپ‌تاپ",
  "difficulty": 1,
  "age": 7
 },
 {
  "id": "cars",
  "label": "خودرو",
  "icon": "car",
  "text": "تاکسی",
  "related": "اتوبوس",
  "difficulty": 1,
  "age": 7
 },
 {
  "id": "people",
  "label": "چهره‌ها",
  "icon": "user-round",
  "text": "حافظ",
  "related": "سعدی",
  "difficulty": 2,
  "age": 12
 },
 {
  "id": "history",
  "label": "تاریخ و جغرافیا",
  "icon": "landmark",
  "text": "تخت جمشید",
  "related": "پاسارگاد",
  "difficulty": 2,
  "age": 12
 },
 {
  "id": "science",
  "label": "علم و مهندسی",
  "icon": "flask-conical",
  "text": "تلسکوپ",
  "related": "میکروسکوپ",
  "difficulty": 2,
  "age": 12
 },
 {
  "id": "iran",
  "label": "فرهنگ ایران",
  "icon": "flower-2",
  "text": "شب یلدا",
  "related": "نوروز",
  "difficulty": 2,
  "age": 12
 },
 {
  "id": "adult",
  "label": "چالش بزرگسال",
  "icon": "puzzle",
  "text": "تعارض منافع",
  "related": "تضاد نقش",
  "difficulty": 2,
  "age": 18
 }
]


def forwards(apps, schema_editor):
    Settings = apps.get_model("spy", "SpySettings")
    Category = apps.get_model("spy", "SpyCategory")
    Word = apps.get_model("spy", "SpyWord")
    if not Settings.objects.exists():
        Settings.objects.create()
    for order, c in enumerate(SEED):
        cat, _ = Category.objects.get_or_create(slug=c["id"], defaults={"name": c["label"], "icon": c["icon"], "order": order})
        Word.objects.get_or_create(
            category=cat, text=c["text"], defaults={"related": c["related"], "difficulty": c["difficulty"], "age": c["age"]}
        )


class Migration(migrations.Migration):
    dependencies = [("spy", "0001_initial")]

    # Going back keeps the words: by then Bordino may have edited or added some (undoing 0001 drops
    # the tables anyway).
    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
