from celery import shared_task

from apps.crash.services.rounds import settle_due


@shared_task
def settle_expired_crash_rounds():
    """Settle rounds whose player left: pays auto cash-outs, closes crashed rounds."""
    return settle_due()
