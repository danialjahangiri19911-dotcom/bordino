from rest_framework import mixins
from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import GenericViewSet

from apps.django_helper.drf.pagination.custom_page_number import CustomPageNumberPagination
from apps.wallet.repositories.wallet.query import WalletQueryRepository
from apps.wallet.serializers.sponsor_wallet.list import SponsorWalletSerializer


class SponsorWalletCRUDView(
    mixins.RetrieveModelMixin,
    GenericViewSet,
):
    serializer_class = SponsorWalletSerializer
    pagination_class = CustomPageNumberPagination
    permission_classes = (IsAuthenticated,)

    def get_queryset(self):
        user = self.request.user
        return WalletQueryRepository.sponsor_wallet(user)
