from django.db import migrations


def drop(apps, schema_editor):
    # An address with a "#" part is never a separate device (the push service never sees it).
    apps.get_model("notifications", "PushSubscription").objects.filter(endpoint__contains="#").delete()


class Migration(migrations.Migration):
    dependencies = [
        ("notifications", "0002_app_device"),
    ]

    operations = [migrations.RunPython(drop, migrations.RunPython.noop)]
