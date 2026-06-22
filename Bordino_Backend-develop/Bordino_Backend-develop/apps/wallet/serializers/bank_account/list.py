from apps.django_helper.drf.serializers import BaseModelSerializer
from apps.wallet.models import BankAccount
from apps.wallet.serializers.bank.list import BankSerializer


class BankAccountSerializer(BaseModelSerializer):
    bank = BankSerializer(read_only=True)

    class Meta:
        model = BankAccount
        fields = (
            "iban",
            "bank",
            "account_holder",
            "status",
        )
