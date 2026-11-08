import json

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction

from django_celery_beat.models import CrontabSchedule, IntervalSchedule, PeriodicTask

from apps.crash.tasks import settle_expired_crash_rounds
from apps.gamemaster.tasks import gamemaster_tick
from apps.lottery.tasks import process_lottery_winners


class Command(BaseCommand):
    help = """
    Setup celery beat periodic tasks.

    Following tasks will be created:

        - ....
    """

    @transaction.atomic
    def handle(self, *args, **kwargs):  # pylint: disable=unused-argument
        """
        Example:
        {
            'task': periodic_task_name,
            'name': 'Periodic task description',
            # Everyday at 15:45
            # https://crontab.guru/#45_15_*_*_*
            'cron': {
                'minute': '45',
                'hour': '15',
                'day_of_week': '*',
                'day_of_month': '*',
                'month_of_year': '*',
            },
            'enabled': True
        },
        """
        print("Deleting all periodic tasks and schedules...\n")

        IntervalSchedule.objects.all().delete()
        CrontabSchedule.objects.all().delete()
        PeriodicTask.objects.all().delete()

        periodic_tasks_data = [
            {
                "task": process_lottery_winners,
                "name": "process_lottery_winners",
                # Every 5 minutes: a lottery is drawn within minutes of its end time (it used to
                # wait for midnight). Only lotteries past their end date are touched.
                "cron": {
                    "minute": "*/5",
                    "hour": "*",
                    "day_of_week": "*",
                    "day_of_month": "*",
                    "month_of_year": "*",
                },
                "enabled": True,
            },
            {
                # Pays auto cash-outs and closes crashed rounds of players who left the game.
                "task": settle_expired_crash_rounds,
                "name": "settle_expired_crash_rounds",
                "cron": {
                    "minute": "*",
                    "hour": "*",
                    "day_of_week": "*",
                    "day_of_month": "*",
                    "month_of_year": "*",
                },
                "enabled": True,
            },
            {
                # Creator games: expiry, wrap-up and «ending soon» notices.
                "task": gamemaster_tick,
                "name": "gamemaster_tick",
                "cron": {
                    "minute": "*/10",
                    "hour": "*",
                    "day_of_week": "*",
                    "day_of_month": "*",
                    "month_of_year": "*",
                },
                "enabled": True,
            },
        ]

        timezone = settings.TIME_ZONE_CELERY_BEAT

        for periodic_task in periodic_tasks_data:
            print(f"Setting up {periodic_task['task'].name}")

            cron = CrontabSchedule.objects.create(timezone=timezone, **periodic_task["cron"])

            args = json.dumps(
                periodic_task.get("args", []),
            )

            queue = periodic_task.get("queue", None)

            PeriodicTask.objects.create(
                name=periodic_task["name"],
                task=periodic_task["task"].name,
                crontab=cron,
                enabled=periodic_task["enabled"],
                args=args,
                queue=queue,
            )
