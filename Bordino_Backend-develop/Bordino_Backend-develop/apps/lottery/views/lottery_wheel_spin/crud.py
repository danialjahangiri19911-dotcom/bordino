from rest_framework import mixins
from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import GenericViewSet

from apps.django_helper.drf.pagination.custom_page_number import CustomPageNumberPagination
from apps.lottery.models import LotteryWheel
from apps.lottery.serializers.lottery_wheel_spin.crud import LotteryWheelSpinCRUDSerializer


class LotteryWheelSpinCRUDView(
    mixins.CreateModelMixin,
    GenericViewSet,
):
    serializer_class = LotteryWheelSpinCRUDSerializer
    pagination_class = CustomPageNumberPagination
    permission_classes = [IsAuthenticated]
    queryset = LotteryWheel.objects.filter(status=LotteryWheel.Status.ACTIVE)
