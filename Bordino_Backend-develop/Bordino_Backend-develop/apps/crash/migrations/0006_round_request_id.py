from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("crash", "0005_alter_chickenconfiguration_difficulties"),
    ]

    operations = [
        migrations.AddField(
            model_name="crashround",
            name="request_id",
            field=models.CharField(blank=True, editable=False, max_length=64, null=True),
        ),
        migrations.AddField(
            model_name="chickenround",
            name="request_id",
            field=models.CharField(blank=True, editable=False, max_length=64, null=True),
        ),
        migrations.AddConstraint(
            model_name="crashround",
            constraint=models.UniqueConstraint(
                condition=models.Q(("request_id__isnull", False)),
                fields=("customer", "request_id"),
                name="crash_unique_request_id",
            ),
        ),
        migrations.AddConstraint(
            model_name="chickenround",
            constraint=models.UniqueConstraint(
                condition=models.Q(("request_id__isnull", False)),
                fields=("customer", "request_id"),
                name="chicken_unique_request_id",
            ),
        ),
    ]
