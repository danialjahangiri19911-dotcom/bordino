from apps.django_helper.drf.serializers import BaseModelSerializer
from apps.wallet.models import Wallet


class WalletMinimalSerializer(BaseModelSerializer):
    class Meta:
        model = Wallet
        fields = ()
