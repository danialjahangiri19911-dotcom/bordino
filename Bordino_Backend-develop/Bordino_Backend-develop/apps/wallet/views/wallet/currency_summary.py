from datetime import timedelta

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from drf_spectacular.utils import extend_schema

from apps.configuration.models import SystemConfiguration
from apps.wallet.models import CurrencyWalletAccount
from apps.wallet.repositories.wallet.query import WalletQueryRepository
from apps.wallet.serializers.wallet.currency_summary import CurrencyWalletSummarySerializer


class CurrencyWalletSummaryView(APIView):
    permission_classes = (IsAuthenticated,)

    @extend_schema(
        tags=["wallet"],
        summary="Get Currency Wallet Summary",
        responses={200: CurrencyWalletSummarySerializer},
    )
    def get(self, request):
        wallets = WalletQueryRepository.customer_wallet(request.user)

        currency_accounts = CurrencyWalletAccount.objects.filter(wallet__in=wallets).select_related(
            "preset_wallet", "preset_wallet__currency", "wallet"
        )

        account_summaries = []
        for account in currency_accounts:
            expire_date = account.wallet.create_time + timedelta(
                days=SystemConfiguration.objects.get("WALLET_CURRENCY_EXPIRATION_DAYS", 365)
            )

            account_summaries.append(
                {
                    "id": account.id,
                    "name": account.name,
                    "preset_wallet": account.preset_wallet.id,
                    "wallet_id": account.wallet.id,
                    "wallet_type": account.wallet.wallet_type,
                    "primary": account.primary,
                    "balance": account.balance,
                    "status": account.status,
                    "expire_date": expire_date,
                }
            )

        serializer = CurrencyWalletSummarySerializer(
            {"currency_wallet_accounts": account_summaries}
        )
        return Response(serializer.data)
