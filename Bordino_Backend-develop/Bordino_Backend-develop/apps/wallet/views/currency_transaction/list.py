from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import mixins
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import GenericViewSet

from drf_spectacular.utils import OpenApiParameter, extend_schema

from apps.django_helper.drf.mixins.list_serializer import ListSerializerMixin
from apps.django_helper.drf.pagination.custom_page_number import CustomPageNumberPagination
from apps.wallet.models import CurrencyWalletAccount
from apps.wallet.serializers.currency_transaction.list import CurrencyTransactionSerializer
from apps.wallet.serializers.wallet.transaction import WalletTransactionSerializer
from apps.wallet.services.history import currency_history


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
        responses={200: WalletTransactionSerializer(many=True)},
    )
    def list(self, request, *args, **kwargs):
        user = request.user
        account_id = request.query_params.get("currency_wallet_account_id")
        currency_account = None
        if account_id:
            try:
                currency_account = CurrencyWalletAccount.objects.get(id=account_id, wallet__owner=user)
            except (CurrencyWalletAccount.DoesNotExist, DjangoValidationError) as exc:
                raise ValidationError(
                    {"currency_wallet_account_id": "Currency wallet account not found"}
                ) from exc
        # Withdrawals with their state, lottery prizes and cash wheel prizes, newest first.
        rows = currency_history(user, currency_account)
        page = self.paginate_queryset(rows)
        return self.get_paginated_response(WalletTransactionSerializer(page, many=True).data)
