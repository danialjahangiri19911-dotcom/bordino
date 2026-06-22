from apps.django_helper.drf.serializers import BaseModelSerializer
from apps.wallet.models import Bank
from apps.wallet.serializers.wallet.fields import AbsoluteURLField


class BankSerializer(BaseModelSerializer):
    icon = AbsoluteURLField()

    class Meta:
        model = Bank
        fields = ("name", "code", "icon", "is_active")
