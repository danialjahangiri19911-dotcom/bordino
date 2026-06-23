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
        # MEDIA_URL is "media/" (no leading slash); without one
        # build_absolute_uri would resolve it relative to the API path.
        media_url = settings.MEDIA_URL
        if not media_url.startswith("/"):
            media_url = "/" + media_url
        path = f"{media_url}{obj.audio_url}"
        if request:
            return request.build_absolute_uri(path)
        return path

    class Meta:
        model = FortuneReading
        fields = ("type", "question", "result", "audio_url")
