from django.conf import settings
from rest_framework import serializers

from apps.django_helper.drf.serializers import BaseModelSerializer
from apps.entertainment.models.fortune_reading import FortuneReading


class FortuneReadingSerializer(BaseModelSerializer):
    audio_url = serializers.SerializerMethodField()

    def get_audio_url(self, obj):
        if not obj.audio_url:
            return None
        request = self.context.get("request")
        path = f"{settings.MEDIA_URL}{obj.audio_url}"
        if request:
            return request.build_absolute_uri(path)
        return path

    class Meta:
        model = FortuneReading
        fields = ("type", "question", "result", "audio_url")
