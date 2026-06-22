from django.utils.translation import gettext_lazy as _
from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.wallet.repositories.token_wallet_account.query import TokenWalletAccountQueryRepository
from apps.wallet.schemas.activity.score_status import score_status_schema
from apps.wallet.services.utils import get_max_negative_limit


class ScoreStatusViewSet(viewsets.ViewSet):
    permission_classes = (IsAuthenticated,)

    @score_status_schema
    def list(self, request):
        user = request.user
        account_id = request.query_params.get("token_wallet_account_id")

        if account_id:
            token_account = TokenWalletAccountQueryRepository.get_by_id_for_user(user, account_id)
            if not token_account:
                return Response(
                    {"error": _("Token wallet account not found")},
                    status=status.HTTP_404_NOT_FOUND,
                )
        else:
            token_account = TokenWalletAccountQueryRepository.get_last_active_for_user(user)

        max_negative = get_max_negative_limit("points")
        balance = int(token_account.amount) if token_account else 0

        return Response(
            {
                "balance": balance,
                "max_negative_allowed": -max_negative,
            }
        )
