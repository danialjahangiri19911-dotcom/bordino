from django.db.models import Count, ExpressionWrapper, FloatField, Max, Sum, Window
from django.db.models.functions import FirstValue

from apps.lottery.models import Ticket


class LotteryQueryRepository:
    def get_winning_tickets(self, lottery):
        """Get all winning tickets for the lottery with annotations."""
        return (
            lottery.tickets.filter(
                matched_numbers__gt=0, prize_amount__gt=0, status=Ticket.Status.WINNER
            )
            .select_related("customer", "customer__user")
            .annotate(
                # Add any ticket-level annotations here
                highest_match=Window(
                    expression=FirstValue("matched_numbers"),
                    partition_by="customer_id",
                    order_by="-matched_numbers",
                )
            )
            .order_by("-matched_numbers", "-prize_amount")
        )

    def get_total_winners(self, lottery):
        """Get count of unique winners using annotation."""
        return (
            lottery.tickets.filter(
                matched_numbers__gt=0, prize_amount__gt=0, status=Ticket.Status.WINNER
            )
            .values("customer")
            .distinct()
            .count()
        )

    def get_total_prize_pool(self, lottery):
        """Get total prize pool with single query."""
        result = lottery.tickets.filter(status=Ticket.Status.WINNER, prize_amount__gt=0).aggregate(
            total_prize=Sum("prize_amount"),
            winners_count=Count("customer", distinct=True),
        )
        return result["total_prize"] or 0

    def get_summary(self, lottery):
        """Get lottery summary statistics with single query."""
        winning_tickets = lottery.tickets.filter(
            matched_numbers__gt=0, prize_amount__gt=0, status=Ticket.Status.WINNER
        )

        summary = winning_tickets.aggregate(
            total_tickets=Count("id", distinct=True),
            winning_tickets_count=Count("id"),
            unique_winners_count=Count("customer", distinct=True),
            total_prize_amount=Sum("prize_amount"),
            highest_prize=Max("prize_amount"),
        )

        # Add total tickets count from all tickets
        summary["total_tickets"] = lottery.tickets.count()
        return summary

    def get_customer_data(self, lottery):
        """Group winning tickets by customer using annotations."""
        customers = (
            lottery.tickets.filter(
                matched_numbers__gt=0, prize_amount__gt=0, status=Ticket.Status.WINNER
            )
            .values("customer_id")
            .annotate(
                total_prize_amount=Sum("prize_amount"),
                tickets_count=Count("id"),
                highest_match=Max("matched_numbers"),
            )
            .order_by("-highest_match", "-total_prize_amount")
        )

        # Get winning tickets for each customer
        customers_data = {}
        for customer in customers:
            customer_tickets = lottery.tickets.filter(
                customer_id=customer["customer_id"],
                status=Ticket.Status.WINNER,
                prize_amount__gt=0,
            ).values_list("id", flat=True)

            customers_data[customer["customer_id"]] = {
                "customer_id": customer["customer_id"],
                "total_prize_amount": customer["total_prize_amount"],
                "tickets_count": customer["tickets_count"],
                "winning_tickets": list(customer_tickets),
                "highest_match": customer["highest_match"],
            }

        return customers_data

    def get_results_by_match(self, lottery):
        """Group winning *tickets* by match count.

        هر بلیطِ برنده یک ردیفِ مجزاست (یک شخص می‌تواند در چند ردیف ظاهر شود)،
        ذیلِ ردیفِ تطبیقِ همان بلیط.
        """
        winning_tickets = lottery.tickets.filter(
            matched_numbers__gt=0, prize_amount__gt=0, status=Ticket.Status.WINNER
        ).order_by("-matched_numbers", "-prize_amount")

        results = {}
        for ticket in winning_tickets:
            matched = ticket.matched_numbers

            if matched not in results:
                results[matched] = {
                    "matched_numbers": matched,
                    "winners": [],
                    "total_prize": 0,
                    "winners_count": 0,
                }

            group = results[matched]
            group["winners"].append(
                {
                    "customer_id": ticket.customer_id,
                    "total_prize_amount": ticket.prize_amount,
                    "tickets_count": 1,
                    "winning_tickets": [ticket.id],
                    "highest_match": matched,
                }
            )
            group["total_prize"] += ticket.prize_amount
            group["winners_count"] += 1

        processed_results = []
        for group in results.values():
            group["average_prize_per_winner"] = (
                group["total_prize"] / group["winners_count"]
                if group["winners_count"] > 0
                else 0
            )
            group["winners"].sort(key=lambda x: x["total_prize_amount"], reverse=True)
            processed_results.append(group)

        # Sort by matched numbers descending
        return sorted(processed_results, key=lambda x: x["matched_numbers"], reverse=True)

    def get_match_statistics(self, lottery):
        """Get detailed statistics for each match count."""
        return (
            lottery.tickets.filter(
                matched_numbers__gt=0, prize_amount__gt=0, status=Ticket.Status.WINNER
            )
            .values("matched_numbers")
            .annotate(
                tickets_count=Count("id"),
                unique_winners=Count("customer", distinct=True),
                total_prize=Sum("prize_amount"),
                avg_prize=ExpressionWrapper(
                    Sum("prize_amount") * 1.0 / Count("id"), output_field=FloatField()
                ),
                highest_prize=Max("prize_amount"),
            )
            .order_by("-matched_numbers")
        )
