from django.db.models import Q
from rest_framework import mixins
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import GenericViewSet

from drf_spectacular.utils import OpenApiParameter, extend_schema

from apps.django_helper.drf.mixins.list_serializer import ListSerializerMixin
from apps.django_helper.drf.pagination.custom_page_number import CustomPageNumberPagination
from apps.wallet.models import CurrencyTransaction, CurrencyWalletAccount
from apps.wallet.repositories.wallet.query import WalletQueryRepository
from apps.wallet.serializers.currency_transaction.list import CurrencyTransactionSerializer


class CurrencyTransactionListView(
    ListSerializerMixin,
    mixins.ListModelMixin,
    GenericViewSet,
):
    serializer_list_class = CurrencyTransactionSerializer
    pagination_class = CustomPageNumberPagination
    permission_classes = (IsAuthenticated,)

    @extend_schema(
        tags=["wallet"],
        summary="Get Currency Transactions",
        description="Get paginated list of currency transactions. Optionally filter by currency_wallet_account_id query parameter.",
        parameters=[
            OpenApiParameter(
                name="currency_wallet_account_id",
                type=str,
                location=OpenApiParameter.QUERY,
                required=False,
                description="Filter transactions by currency wallet account ID. If not provided, returns transactions for all user's currency wallet accounts.",
            ),
        ],
        responses={200: CurrencyTransactionSerializer(many=True)},
    )
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    def get_queryset(self):
        user = self.request.user
        account_id = self.request.query_params.get("currency_wallet_account_id")

        if account_id:
            try:
                currency_account = CurrencyWalletAccount.objects.get(
                    id=account_id, wallet__owner=user
                )
                return CurrencyTransaction.objects.filter(
                    Q(destination_wallet=currency_account) | Q(source_wallet=currency_account)
                ).select_related("currency", "bank_account")
            except CurrencyWalletAccount.DoesNotExist:
                raise ValidationError(
                    {"currency_wallet_account_id": "Currency wallet account not found"}
                )

        wallets = WalletQueryRepository.customer_wallet(user)
        if not wallets.exists():
            return CurrencyTransaction.objects.none()

        currency_accounts = CurrencyWalletAccount.objects.filter(wallet__in=wallets)
        return CurrencyTransaction.objects.filter(
            Q(destination_wallet__in=currency_accounts) | Q(source_wallet__in=currency_accounts)
        ).select_related("currency", "bank_account")
