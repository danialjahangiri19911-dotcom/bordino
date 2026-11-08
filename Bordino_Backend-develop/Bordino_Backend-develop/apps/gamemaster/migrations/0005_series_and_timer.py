"""Creator games already published: each Mystery learns its game (`series`, edition 1), so its
versions share one leaderboard and one game per player. And the timer that keeps games in step with
time (expiry, wrap-up, «ending soon») is registered with celery beat."""

from django.conf import settings
from django.db import migrations


def forwards(apps, schema_editor):
    Mystery = apps.get_model("missions", "Mystery")
    for m in Mystery.objects.filter(source_version__isnull=False, series__isnull=True).select_related("source_version"):
        Mystery.objects.filter(pk=m.pk).update(series=m.source_version.game_id, edition=1)
    CrontabSchedule = apps.get_model("django_celery_beat", "CrontabSchedule")
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")
    if PeriodicTask.objects.filter(name="gamemaster_tick").exists():
        return
    cron = CrontabSchedule.objects.create(
        minute="*/10", hour="*", day_of_week="*", day_of_month="*", month_of_year="*",
        timezone=getattr(settings, "TIME_ZONE_CELERY_BEAT", settings.TIME_ZONE),
    )
    PeriodicTask.objects.create(name="gamemaster_tick", task="apps.gamemaster.tasks.gamemaster_tick", crontab=cron, enabled=True, args="[]")


def backwards(apps, schema_editor):
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")
    PeriodicTask.objects.filter(name="gamemaster_tick").delete()


class Migration(migrations.Migration):
    dependencies = [
        ("gamemaster", "0004_game_edition_alter_game_status_gamenotice"),
        ("missions", "0008_mystery_edition_mystery_grace_ends_at_and_more"),
        ("django_celery_beat", "0019_alter_periodictasks_options"),
    ]

    operations = [migrations.RunPython(forwards, backwards)]
