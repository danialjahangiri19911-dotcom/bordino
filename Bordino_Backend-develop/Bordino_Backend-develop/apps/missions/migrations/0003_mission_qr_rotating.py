from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("missions", "0002_missionattempt_opened_at"),
    ]

    operations = [
        migrations.AddField(
            model_name="mission",
            name="qr_rotating",
            field=models.BooleanField(
                default=False,
                help_text="روشن: به‌جای QR چاپی، یک تبلت یا تلویزیون در محل لینک «نمایشگر» را باز می‌کند و هر ۳۰ ثانیه QR تازه نشان می‌دهد. عکسِ فرستاده‌شدهٔ QR بعد از ۲ دقیقه کار نمی‌کند و QR چاپی قبلی هم دیگر پذیرفته نمی‌شود.",
                verbose_name="QR متغیر روی نمایشگر محل",
            ),
        ),
        migrations.AddField(
            model_name="mission",
            name="qr_display_key",
            field=models.CharField(blank=True, editable=False, max_length=64, null=True, unique=True),
        ),
    ]
