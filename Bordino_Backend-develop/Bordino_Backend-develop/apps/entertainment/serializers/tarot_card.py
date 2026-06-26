from apps.django_helper.drf.serializers import BaseModelSerializer
from apps.entertainment.models.tarot_card import TarotCard


class TarotCardSerializer(BaseModelSerializer):
    class Meta:
        model = TarotCard
        fields = ("order", "name", "symbol", "interpretation")
