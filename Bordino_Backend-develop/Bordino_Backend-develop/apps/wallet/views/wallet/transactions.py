from django.db.models import Q
from django.utils.translation import gettext_lazy as _
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from drf_spectacular.utils import OpenApiParameter, extend_schema

from apps.django_helper.drf.pagination.custom_page_number import CustomPageNumberPagination
from apps.wallet.models import TokenWalletAccount
from apps.wallet.models.transactions.lottery_ticket import LotteryTicketTransaction
from apps.wallet.models.transactions.lottery_prize import LotteryPrizeTransaction
from apps.wallet.models.transactions.lottery_wheel_prize import LotteryWheelPrizeTransaction
from apps.wallet.models.transactions.referral import ReferralRewardTransaction
from apps.wallet.models.transactions.token import TokenTransaction
from apps.wallet.repositories.lottery_ticket_transaction.query import (
    LotteryTicketTransactionQueryRepository,
)
from apps.wallet.serializers.wallet.transaction import WalletTransactionSerializer


class PointsWalletTransactionsView(APIView):
    permission_classes = (IsAuthenticated,)
    pagination_class = CustomPageNumberPagination

    @extend_schema(
        tags=["wallet"],
        summary="Get Wallet Transactions",
        description="Get paginated list of all wallet transactions. Optionally filter by token_wallet_account_id query parameter.",
        parameters=[
            OpenApiParameter(
                name="token_wallet_account_id",
                type=str,
                location=OpenApiParameter.QUERY,
                required=False,
                description="Filter transactions by token wallet account ID. If not provided, returns transactions for all user's token wallet accounts.",
            ),
        ],
        responses={200: WalletTransactionSerializer(many=True)},
    )
    def get(self, request):
        user = request.user
        customer = user.customer
        account_id = request.query_params.get("token_wallet_account_id")
        if account_id is not None:
            account_id = account_id.strip() or None

        token_account = None
        if account_id:
            try:
                token_account = TokenWalletAccount.objects.get(id=account_id, wallet__owner=user)
            except TokenWalletAccount.DoesNotExist:
                raise ValidationError({"token_wallet_account_id": "Token wallet account not found"})

        transactions = []

        # Only settled purchases represent an actual balance change. Pending
        # tickets (converted but not yet finalized via number submission) must not
        # appear in the wallet transaction history.
        ticket_transactions = LotteryTicketTransactionQueryRepository.filter_by_customer(
            customer=customer, token_account=token_account
        ).filter(status=LotteryTicketTransaction.Status.COMPLETED)
        for txn in ticket_transactions:
            icon = None
            if txn.token and txn.token.logo and txn.token.logo.file:
                icon = txn.token.logo.file.url
            title = txn.lottery.name if txn.lottery else _("Ticket purchase")
            transactions.append(
                {
                    "id": txn.id,
                    "type": "ticket_purchase",
                    "title": title,
                    "amount": txn.amount * txn.token.price,
                    "is_positive": False,
                    "date": txn.create_time.date(),
                    "icon": icon,
                    "reference": str(txn.id).replace("-", "")[-8:],
                }
            )

        referral_transactions_query = ReferralRewardTransaction.objects.filter(referrer=customer)
        if token_account and token_account.token:
            referral_transactions_query = referral_transactions_query.filter(
                token=token_account.token
            )
        referral_transactions = referral_transactions_query.select_related("token", "token__logo")
        for txn in referral_transactions:
            icon = None
            if txn.token and txn.token.logo and txn.token.logo.file:
                icon = txn.token.logo.file.url
            transactions.append(
                {
                    "id": txn.id,
                    "type": "referral_reward",
                    "title": _("Referral reward"),
                    "amount": txn.tokens_amount * txn.token.price,
                    "is_positive": True,
                    "date": txn.create_time.date(),
                    "icon": icon,
                    "reference": str(txn.id).replace("-", "")[-8:],
                }
            )

        prize_transactions_query = LotteryPrizeTransaction.objects.filter(ticket__customer=customer)
        if token_account and token_account.token:
            prize_transactions_query = prize_transactions_query.filter(
                lottery__token=token_account.token
            )
        prize_transactions = prize_transactions_query.select_related(
            "lottery", "ticket", "lottery__token", "lottery__token__logo"
        )
        for txn in prize_transactions:
            icon = None
            if (
                txn.lottery
                and txn.lottery.token
                and txn.lottery.token.logo
                and txn.lottery.token.logo.file
            ):
                icon = txn.lottery.token.logo.file.url
            transactions.append(
                {
                    "id": txn.id,
                    "type": "lottery_prize",
                    "title": _("Lottery prize"),
                    "amount": txn.prize_amount or 0,
                    "is_positive": True,
                    "date": txn.create_time.date(),
                    "icon": icon,
                    "reference": str(txn.id).replace("-", "")[-8:],
                }
            )

        wheel_prize_transactions = LotteryWheelPrizeTransaction.objects.filter(
            customer=customer
        ).select_related("lottery_wheel", "prize")
        for txn in wheel_prize_transactions:
            icon = None
            transactions.append(
                {
                    "id": txn.id,
                    "type": "wheel_prize",
                    "title": _("Wheel prize"),
                    "amount": txn.prize.prize_amount or 0,
                    "is_positive": True,
                    "date": txn.create_time.date(),
                    "icon": icon,
                    "reference": str(txn.id).replace("-", "")[-8:],
                }
            )

        token_transactions_query = TokenTransaction.objects.filter(
            Q(source_wallet__wallet__owner=user) | Q(destination_wallet__wallet__owner=user)
        )
        if token_account:
            token_transactions_query = token_transactions_query.filter(
                Q(source_wallet=token_account) | Q(destination_wallet=token_account)
            )
        token_transactions = token_transactions_query.select_related(
            "source_wallet", "destination_wallet", "token", "token__logo"
        )
        for txn in token_transactions:
            is_positive = txn.destination_wallet.wallet.owner == user
            icon = None
            if txn.token and txn.token.logo and txn.token.logo.file:
                icon = txn.token.logo.file.url
            transactions.append(
                {
                    "id": txn.id,
                    "type": "points_transfer",
                    "title": _("Points transfer"),
                    "amount": txn.amount * txn.token.price,
                    "is_positive": is_positive,
                    "date": txn.create_time.date(),
                    "icon": icon,
                    "reference": str(txn.id).replace("-", "")[-8:],
                }
            )

        transactions.sort(key=lambda x: x["date"], reverse=True)

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(transactions, request)
        serializer = WalletTransactionSerializer(page, many=True, context={"request": request})
        return paginator.get_paginated_response(serializer.data)
