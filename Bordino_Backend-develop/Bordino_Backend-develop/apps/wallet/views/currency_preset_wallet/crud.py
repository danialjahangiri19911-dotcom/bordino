from rest_framework import mixins
from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import GenericViewSet

from apps.django_helper.drf.mixins.list_serializer import ListSerializerMixin
from apps.django_helper.drf.pagination.custom_page_number import CustomPageNumberPagination
from apps.wallet.models import CurrencyPresetWallet
from apps.wallet.serializers.currency_preset_wallet.list import CurrencyPresetWalletSerializer


class CurrencyPresetWalletCRUDView(ListSerializerMixin, mixins.ListModelMixin, GenericViewSet):
    serializer_list_class = CurrencyPresetWalletSerializer  # type: ignore[assignment]
    pagination_class = CustomPageNumberPagination
    permission_classes = (IsAuthenticated,)

    def get_queryset(self):
        return CurrencyPresetWallet.objects.filter(
            wallet_type=CurrencyPresetWallet.WalletType.CUSTOMER
        )
