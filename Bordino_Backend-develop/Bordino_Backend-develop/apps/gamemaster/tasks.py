from celery import shared_task

from apps.gamemaster import services


@shared_task
def gamemaster_tick():
    """Creator games kept in step with time: expired, wrapped up (budget back, leaderboard frozen),
    «ending soon» notices. The game runtime refuses late moves on its own; this only records."""
    return services.tick()
