from rest_framework import mixins
from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import GenericViewSet

from apps.django_helper.drf.mixins.list_serializer import ListSerializerMixin
from apps.django_helper.drf.pagination.custom_page_number import CustomPageNumberPagination
from apps.lottery.models import LotteryWheel
from apps.lottery.serializers.lottery_wheel.list import LotteryWheelSerializer
from apps.lottery.serializers.lottery_wheel.minimal import LotteryWheelMinimalSerializer


class LotteryWheelCRUDView(
    ListSerializerMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    # mixins.CreateModelMixin,
    GenericViewSet,
):
    serializer_list_class = LotteryWheelMinimalSerializer  # type: ignore[assignment]
    serializer_class = LotteryWheelSerializer
    pagination_class = CustomPageNumberPagination
    permission_classes = (IsAuthenticated,)
    queryset = LotteryWheel.objects.filter(status=LotteryWheel.Status.ACTIVE)
