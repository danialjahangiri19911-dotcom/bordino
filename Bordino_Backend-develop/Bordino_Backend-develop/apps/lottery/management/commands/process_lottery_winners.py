from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.lottery.models import Lottery
from apps.lottery.services.lottery.lottery_winner import LotteryWinnerService


class Command(BaseCommand):
    help = "Process winners for ended lotteries"

    def handle(self, *args, **options):  # pylint: disable=unused-argument
        # Get active lotteries that have ended
        lotteries = Lottery.objects.filter(
            status=Lottery.Status.ACTIVE, end_date__lte=timezone.now()
        )

        for lottery in lotteries:
            try:
                service = LotteryWinnerService(lottery)
                result = service.process_winners()

                self.stdout.write(
                    self.style.SUCCESS(
                        f"Successfully processed lottery {lottery.name}:\n"
                        f"Total winners: {result['total_winners']}\n"
                        f"Total prize amount: {result['total_prize_amount']}"
                    )
                )

                # Print details for each category
                for matches, data in result["winners_by_category"].items():
                    self.stdout.write(
                        f"{matches} matches: {data['count']} winners, "
                        f"{data['adjusted_prize']} per ticket"
                    )

            except Exception as e:  # pylint: disable=broad-exception-caught
                self.stdout.write(
                    self.style.ERROR(f"Failed to process lottery {lottery.name}: {e!s}")
                )
