from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("wallet", "0033_adrewardsession_external_event_id_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="gameplaycharge",
            name="difficulty",
            field=models.CharField(blank=True, default="", editable=False, max_length=20),
        ),
    ]
