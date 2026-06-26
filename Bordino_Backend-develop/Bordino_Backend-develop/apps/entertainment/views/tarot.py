from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from drf_spectacular.utils import OpenApiParameter, extend_schema

from apps.entertainment.models.tarot_card import TarotCard
from apps.entertainment.serializers.tarot_card import TarotCardSerializer

ALLOWED_COUNTS = (3, 5)


class TarotDrawView(APIView):
    """کشیدنِ یک فالِ تاروت: تعدادِ مشخصی کارتِ تصادفیِ بدونِ تکرار."""

    permission_classes = (IsAuthenticated,)

    @extend_schema(
        tags=["entertainment"],
        summary="Draw a tarot reading",
        description="چند کارتِ تصادفیِ بدونِ تکرار (۳ یا ۵ کارتی) به‌همراه تفسیر برمی‌گرداند.",
        parameters=[
            OpenApiParameter(
                name="count",
                type=int,
                description="تعدادِ کارت‌ها: ۳ یا ۵ (پیش‌فرض ۳)",
                required=False,
            ),
        ],
        responses={200: TarotCardSerializer(many=True)},
        operation_id="draw_tarot_reading",
    )
    def get(self, request):
        try:
            count = int(request.query_params.get("count", 3))
        except (TypeError, ValueError):
            count = 3
        if count not in ALLOWED_COUNTS:
            count = 3

        cards = list(TarotCard.objects.order_by("?")[:count])
        if not cards:
            return Response(
                {"detail": "No tarot cards found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = TarotCardSerializer(cards, many=True, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)
