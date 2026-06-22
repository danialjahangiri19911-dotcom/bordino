from rest_framework import mixins
from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import GenericViewSet

from apps.django_helper.drf.mixins.list_serializer import ListSerializerMixin
from apps.django_helper.drf.pagination.custom_page_number import CustomPageNumberPagination
from apps.wallet.models import Wallet
from apps.wallet.serializers.wallet.list import WalletSerializer
from apps.wallet.serializers.wallet.minimal import WalletMinimalSerializer


class WalletCRUDView(
    ListSerializerMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    GenericViewSet,
):
    serializer_list_class = WalletMinimalSerializer  # type: ignore[assignment]
    serializer_class = WalletSerializer
    pagination_class = CustomPageNumberPagination
    permission_classes = (IsAuthenticated,)

    def get_queryset(self):
        user = self.request.user
        return Wallet.objects.filter(owner=user).prefetch_related(
            "currency_wallet_accounts", "token_wallet_accounts"
        )
