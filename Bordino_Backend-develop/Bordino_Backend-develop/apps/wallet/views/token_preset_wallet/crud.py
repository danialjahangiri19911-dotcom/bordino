from rest_framework import mixins
from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import GenericViewSet

from apps.django_helper.drf.mixins.list_serializer import ListSerializerMixin
from apps.django_helper.drf.pagination.custom_page_number import CustomPageNumberPagination
from apps.wallet.models import TokenPresetWallet
from apps.wallet.serializers.token_preset_wallet.list import TokenPresetWalletSerializer


class TokenPresetWalletCRUDView(ListSerializerMixin, mixins.ListModelMixin, GenericViewSet):
    serializer_list_class = TokenPresetWalletSerializer  # type: ignore[assignment]
    pagination_class = CustomPageNumberPagination
    permission_classes = (IsAuthenticated,)

    def get_queryset(self):
        return TokenPresetWallet.objects.filter(wallet_type=TokenPresetWallet.WalletType.CUSTOMER)
