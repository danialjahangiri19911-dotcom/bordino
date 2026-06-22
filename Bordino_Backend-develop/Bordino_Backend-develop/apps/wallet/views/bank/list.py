from rest_framework import mixins
from rest_framework.viewsets import GenericViewSet

from apps.django_helper.drf.mixins.list_serializer import ListSerializerMixin
from apps.wallet.models import Bank
from apps.wallet.serializers.bank.list import BankSerializer


class BankListView(
    ListSerializerMixin,
    mixins.ListModelMixin,
    GenericViewSet,
):
    serializer_list_class = BankSerializer
    queryset = Bank.objects.filter(is_active=True)
