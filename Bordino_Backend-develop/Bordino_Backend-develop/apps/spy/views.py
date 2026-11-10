from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from drf_spectacular.utils import extend_schema

from apps.spy import services


class ReadThrottle(UserRateThrottle):
    scope = "spy_read"
    rate = "60/min"


class SpyConfigView(APIView):
    """The game's switch, topics and word bank (edited in the admin)."""

    permission_classes = (IsAuthenticated,)
    throttle_classes = (ReadThrottle,)

    @extend_schema(tags=["spy"], summary="Spy settings and words")
    def get(self, request):
        return Response(services.config_payload())
