from django.db import migrations

# The rewarded-video settings, listed in admin → System configurations so they can be changed
# without a deploy (services/ad_reward.py reads them; its DEFAULTS apply while a value is empty).
SETTINGS = [
    ("AD_REWARD_ENABLED", "true", "bool", "پیشنهاد ویدیوی جایزه‌دار قبل از بازی روشن باشد."),
    ("AD_REWARD_POINTS", "5", "int", "امتیازی که هر ویدیوی کامل‌دیده‌شده می‌دهد (X)."),
    ("AD_REWARD_DAILY_LIMIT", "5", "int", "حداکثر ویدیوی جایزه‌دار برای هر کاربر در روز."),
    ("AD_REWARD_PROVIDER", "demo", "str", "سرویس تبلیغ؛ فعلاً «demo» (ویدیوی نمونه). بعداً AdDelivery."),
    ("AD_DEMO_VIDEO_URL", "/bd/ads/demo-ad.mp4", "str", "ویدیوی نمونهٔ حالت demo."),
    ("AD_DEMO_SECONDS", "15", "int", "طول ویدیوی نمونه به ثانیه؛ جایزه زودتر از این داده نمی‌شود."),
]


def forwards(apps, schema_editor):
    SystemConfiguration = apps.get_model("configuration", "SystemConfiguration")
    for key, default, value_type, description in SETTINGS:
        # An admin who already set the key keeps their value.
        SystemConfiguration.objects.get_or_create(
            key=key,
            defaults={
                "default_value": default,
                "value_type": value_type,
                "category": "wallet",
                "description": description,
            },
        )


def backwards(apps, schema_editor):
    SystemConfiguration = apps.get_model("configuration", "SystemConfiguration")
    SystemConfiguration.objects.filter(key__in=[s[0] for s in SETTINGS], value__isnull=True).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("wallet", "0030_ad_reward_session"),
        ("configuration", "0006_gameconfiguration_play_cost"),
    ]

    operations = [migrations.RunPython(forwards, backwards)]
