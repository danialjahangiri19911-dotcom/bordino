from rest_framework import mixins
from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import GenericViewSet

from apps.django_helper.drf.mixins.list_serializer import ListSerializerMixin
from apps.django_helper.drf.pagination.custom_page_number import CustomPageNumberPagination
from apps.wallet.models import BankAccount
from apps.wallet.serializers.bank_account.create import BankAccountCreateSerializer
from apps.wallet.serializers.bank_account.list import BankAccountSerializer


class BankAccountViewSet(
    ListSerializerMixin,
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.DestroyModelMixin,
    GenericViewSet,
):
    serializer_list_class = BankAccountSerializer
    serializer_class = BankAccountCreateSerializer
    pagination_class = CustomPageNumberPagination
    permission_classes = (IsAuthenticated,)

    def get_queryset(self):
        return BankAccount.objects.filter(user=self.request.user, is_deleted=False)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def perform_destroy(self, instance):
        instance.is_deleted = True
        instance.save(update_fields=["is_deleted"])
