from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from drf_spectacular.utils import extend_schema

from apps.entertainment.models.fortune_reading import FortuneReading
from apps.entertainment.serializers.fortune_reading import FortuneReadingSerializer


class RandomFortuneReadingView(APIView):
    permission_classes = (IsAuthenticated,)

    @extend_schema(
        tags=["entertainment"],
        summary="Get Random Fortune Reading",
        description="Returns a random fortune reading record.",
        responses={
            200: FortuneReadingSerializer,
            404: {"type": "object", "properties": {"detail": {"type": "string"}}},
        },
        operation_id="get_random_fortune_reading",
    )
    def get(self, request):
        fortune_reading = FortuneReading.objects.order_by("?").first()

        if not fortune_reading:
            return Response(
                {"detail": "No fortune reading records found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = FortuneReadingSerializer(fortune_reading, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)
