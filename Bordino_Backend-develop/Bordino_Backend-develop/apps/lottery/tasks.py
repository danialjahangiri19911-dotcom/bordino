from django.utils import timezone

from celery import shared_task

from apps.lottery.models import Lottery
from apps.lottery.services.lottery.lottery_winner import LotteryWinnerService


@shared_task
def process_lottery_winners():
    """
    Process winners for all lotteries that have reached their end date.
    This task runs daily at midnight (00:00) to process all lotteries that have ended.
    """
    # Get all active lotteries that have reached their end date
    expired_lotteries = Lottery.objects.filter(
        status=Lottery.Status.ACTIVE, end_date__lte=timezone.now()
    )

    for lottery in expired_lotteries:
        try:
            winner_service = LotteryWinnerService(lottery)
            results = winner_service.process_winners()
            print(f"Processed winners for lottery {lottery.id}: {results}")
        except Exception as e:  # pylint: disable=broad-exception-caught
            print(f"Error processing winners for lottery {lottery.id}: {e!s}")
            # You might want to add proper error handling/logging here
