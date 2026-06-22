from apps.django_helper.drf.serializers import BaseModelSerializer
from apps.wallet.models import BankAccount


class BankAccountCreateSerializer(BaseModelSerializer):
    class Meta:
        model = BankAccount
        fields = ("iban", "bank", "account_holder")
