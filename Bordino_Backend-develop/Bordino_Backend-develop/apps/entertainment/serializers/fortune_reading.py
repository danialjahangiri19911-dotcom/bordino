from apps.django_helper.drf.serializers import BaseModelSerializer
from apps.entertainment.models.fortune_reading import FortuneReading


class FortuneReadingSerializer(BaseModelSerializer):
    class Meta:
        model = FortuneReading
        fields = ("type", "question", "result")
