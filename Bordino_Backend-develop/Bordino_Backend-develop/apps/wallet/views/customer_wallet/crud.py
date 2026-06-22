from rest_framework import mixins
from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import GenericViewSet

from apps.django_helper.drf.pagination.custom_page_number import CustomPageNumberPagination
from apps.wallet.repositories.wallet.query import WalletQueryRepository
from apps.wallet.serializers.customer_wallet.list import CustomerWalletSerializer


class CustomerWalletCRUDView(
    mixins.RetrieveModelMixin,
    GenericViewSet,
):
    serializer_class = CustomerWalletSerializer
    pagination_class = CustomPageNumberPagination
    permission_classes = (IsAuthenticated,)

    def get_queryset(self):
        user = self.request.user
        return WalletQueryRepository.customer_wallet(user)
