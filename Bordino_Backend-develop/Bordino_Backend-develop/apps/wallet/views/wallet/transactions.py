from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from drf_spectacular.utils import OpenApiParameter, extend_schema

from apps.django_helper.drf.pagination.custom_page_number import CustomPageNumberPagination
from apps.wallet.models import TokenWalletAccount
from apps.wallet.serializers.wallet.transaction import WalletTransactionSerializer
from apps.wallet.services.history import points_history


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
        account_id = request.query_params.get("token_wallet_account_id")
        if account_id is not None:
            account_id = account_id.strip() or None

        token_account = None
        if account_id:
            try:
                token_account = TokenWalletAccount.objects.get(id=account_id, wallet__owner=user)
            except TokenWalletAccount.DoesNotExist:
                raise ValidationError({"token_wallet_account_id": "Token wallet account not found"})

        transactions = points_history(user, token_account)

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(transactions, request)
        serializer = WalletTransactionSerializer(page, many=True, context={"request": request})
        return paginator.get_paginated_response(serializer.data)
