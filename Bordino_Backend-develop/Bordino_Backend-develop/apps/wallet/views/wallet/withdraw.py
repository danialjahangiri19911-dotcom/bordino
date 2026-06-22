from decimal import Decimal

from django.db import transaction
from django.utils.translation import gettext_lazy as _
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from drf_spectacular.utils import extend_schema

from apps.wallet.models import BankAccount, CurrencyTransaction
from apps.wallet.repositories.wallet.query import WalletQueryRepository
from apps.wallet.services.utils import (
    get_max_negative_limit,
    is_wallet_expired,
    would_deduction_exceed_negative_limit,
)


class CurrencyWithdrawViewSet(ViewSet):
    permission_classes = (IsAuthenticated,)

    @extend_schema(
        tags=["wallet"],
        summary="Withdraw Currency",
        request={
            "application/json": {
                "type": "object",
                "properties": {
                    "amount": {"type": "number"},
                    "bank_account_id": {"type": "string"},
                },
            }
        },
    )
    @transaction.atomic
    def create(self, request):
        amount = Decimal(request.data.get("amount", 0))
        bank_account_id = request.data.get("bank_account_id")

        if amount <= 0:
            return Response({"error": _("Invalid amount")}, status=status.HTTP_400_BAD_REQUEST)

        wallet = WalletQueryRepository.customer_wallet(request.user).first()
        if not wallet:
            return Response({"error": _("Wallet not found")}, status=status.HTTP_404_NOT_FOUND)

        if is_wallet_expired(wallet):
            return Response({"error": _("Wallet has expired")}, status=status.HTTP_400_BAD_REQUEST)

        currency_account = wallet.currency_wallet_accounts.filter(primary=True).first()
        if not currency_account:
            return Response(
                {"error": _("Currency account not found")},
                status=status.HTTP_404_NOT_FOUND,
            )

        if would_deduction_exceed_negative_limit(
            currency_account.balance,
            amount,
            get_max_negative_limit(currency_account),
        ):
            return Response(
                {"error": _("Withdrawal would exceed maximum negative currency limit.")},
                status=status.HTTP_400_BAD_REQUEST,
            )

        bank_account = BankAccount.objects.filter(
            id=bank_account_id,
            user=request.user,
            status=BankAccount.Status.APPROVED,
            is_deleted=False,
        ).first()
        if not bank_account:
            return Response(
                {"error": _("Bank account not found")}, status=status.HTTP_404_NOT_FOUND
            )

        currency = currency_account.preset_wallet.currency
        currency_account.balance -= amount
        currency_account.save()

        CurrencyTransaction.objects.create(
            amount=amount,
            currency=currency,
            source_wallet=currency_account,
            bank_account=bank_account,
            status=CurrencyTransaction.Status.PENDING,
        )

        return Response(
            {"message": _("Withdrawal request created")}, status=status.HTTP_201_CREATED
        )
