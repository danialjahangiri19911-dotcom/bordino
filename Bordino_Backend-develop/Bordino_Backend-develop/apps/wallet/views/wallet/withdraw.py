from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from drf_spectacular.utils import extend_schema

from apps.wallet.models import BankAccount, CurrencyTransaction
from apps.wallet.services import balance
from apps.wallet.services.utils import is_wallet_expired


class WithdrawSerializer(serializers.Serializer):
    # Rial, whole: the currency balance has no decimals. Malformed values ("abc", null, 1.5) are a
    # 400 here instead of a 500 from Decimal().
    amount = serializers.IntegerField(min_value=1, max_value=10**15)
    bank_account_id = serializers.UUIDField()
    # One id per withdrawal the player starts (made by the app). A retry of a request whose answer
    # was lost carries the same id and gets the first result back instead of a second withdrawal.
    request_id = serializers.CharField(max_length=64, required=False)


class CurrencyWithdrawViewSet(ViewSet):
    permission_classes = (IsAuthenticated,)

    @extend_schema(
        tags=["wallet"],
        summary="Withdraw Currency",
        request=WithdrawSerializer,
    )
    def create(self, request):
        serializer = WithdrawSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        amount = serializer.validated_data["amount"]
        request_id = serializer.validated_data.get("request_id")

        with transaction.atomic():
            # Locked until commit: two withdrawals at once are checked one after the other
            # against the real balance, and a retry with the same request_id finds the first.
            currency_account = balance.currency_account(request.user, lock=True)
            if not currency_account:
                return Response(
                    {"error": _("Currency account not found")},
                    status=status.HTTP_404_NOT_FOUND,
                )

            earlier = (
                CurrencyTransaction.objects.filter(
                    source_wallet=currency_account, request_id=request_id
                ).first()
                if request_id
                else None
            )
            if earlier:
                # The same withdrawal again (its answer was lost): the first result. The same id
                # with a different amount or bank account is not a retry — refuse it.
                same = int(earlier.amount) == amount and str(earlier.bank_account_id) == str(
                    serializer.validated_data["bank_account_id"]
                )
                if not same:
                    return Response(
                        {"error": _("This withdrawal was already requested with other details.")},
                        status=status.HTTP_409_CONFLICT,
                    )
                return Response(
                    {"message": _("Withdrawal request created")}, status=status.HTTP_201_CREATED
                )

            if is_wallet_expired(currency_account.wallet):
                return Response(
                    {"error": _("Wallet has expired")}, status=status.HTTP_400_BAD_REQUEST
                )

            bank_account = BankAccount.objects.filter(
                id=serializer.validated_data["bank_account_id"],
                user=request.user,
                status=BankAccount.Status.APPROVED,
                is_deleted=False,
            ).first()
            if not bank_account:
                return Response(
                    {"error": _("Bank account not found")}, status=status.HTTP_404_NOT_FOUND
                )

            try:
                balance.check_debit(
                    currency_account,
                    amount,
                    _("Withdrawal would exceed maximum negative currency limit."),
                )
            except ValidationError as exc:
                return Response({"error": exc.messages[0]}, status=status.HTTP_400_BAD_REQUEST)

            # Reserved now; given back if the withdrawal fails or is cancelled (wallet signals).
            balance.add_currency(currency_account, -amount)
            CurrencyTransaction.objects.create(
                amount=amount,
                currency=currency_account.preset_wallet.currency,
                source_wallet=currency_account,
                bank_account=bank_account,
                status=CurrencyTransaction.Status.PENDING,
                request_id=request_id or None,
            )

        return Response(
            {"message": _("Withdrawal request created")}, status=status.HTTP_201_CREATED
        )
