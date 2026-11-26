from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("wallet", "0035_adivery_callback_attempt"),
    ]

    operations = [
        migrations.AddField(
            model_name="adrewardsession",
            name="sdk_ref",
            field=models.CharField(blank=True, db_index=True, default="", max_length=100),
        ),
    ]
