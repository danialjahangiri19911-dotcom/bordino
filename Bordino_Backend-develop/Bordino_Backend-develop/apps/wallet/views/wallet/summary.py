from datetime import timedelta
from decimal import Decimal

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from drf_spectacular.utils import extend_schema

from apps.configuration.models import SystemConfiguration
from apps.lottery.models import Lottery, Ticket
from apps.wallet.models import TokenWalletAccount
from apps.wallet.repositories.wallet.query import WalletQueryRepository
from apps.wallet.serializers.wallet.summary import PointsWalletSummarySerializer


class PointsWalletSummaryView(APIView):
    permission_classes = (IsAuthenticated,)

    @extend_schema(
        tags=["wallet"],
        summary="Get Wallet Summary",
        description="Get wallet summary including total points, tickets, and progress",
        responses={200: PointsWalletSummarySerializer},
    )
    def get(self, request):
        user = request.user
        wallets = WalletQueryRepository.customer_wallet(user)

        token_accounts = TokenWalletAccount.objects.filter(wallet__in=wallets).select_related(
            "token", "preset_wallet", "wallet"
        )

        active_lottery = Lottery.objects.filter(status=Lottery.Status.ACTIVE).first()
        if active_lottery and active_lottery.token:
            required_points = Decimal(active_lottery.ticket_price) * Decimal(
                active_lottery.token.price
            )
        else:
            required_points = Decimal(100)

        total_tickets = Ticket.objects.filter(
            customer=user.customer, status=Ticket.Status.ACTIVE
        ).count()

        account_summaries = []
        for account in token_accounts:
            if account.token:
                total_points = Decimal(account.amount) * Decimal(account.token.price)
                if required_points > 0:
                    current_points = total_points % required_points
                    remaining_points = required_points - current_points
                else:
                    current_points = Decimal(0)
                    remaining_points = Decimal(0)
            else:
                total_points = Decimal(0)
                current_points = Decimal(0)
                remaining_points = required_points if required_points > 0 else Decimal(0)

            expire_time = account.wallet.create_time + timedelta(
                days=SystemConfiguration.objects.get("WALLET_TOKEN_EXPIRATION_DAYS", 365)
            )

            account_summaries.append(
                {
                    "id": account.id,
                    "name": account.name,
                    "token": account.token.id if account.token else None,
                    "preset_wallet": account.preset_wallet.id,
                    "wallet_id": account.wallet.id,
                    "wallet_type": account.wallet.wallet_type,
                    "status": account.status,
                    "amount": account.amount,
                    "total_points": total_points,
                    "total_tickets": total_tickets,
                    "current_points": current_points,
                    "required_points": required_points,
                    "remaining_points": remaining_points,
                    "expire_time": expire_time,
                }
            )

        serializer = PointsWalletSummarySerializer({"token_wallet_accounts": account_summaries})
        return Response(serializer.data)
