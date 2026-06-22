from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.lottery.views.lottery.crud import LotteryCRUDView
from apps.lottery.views.lottery_wheel.crud import LotteryWheelCRUDView
from apps.lottery.views.lottery_wheel_spin.crud import LotteryWheelSpinCRUDView
from apps.lottery.views.ticket.crud import TicketCRUDView

_API_ROUTER = DefaultRouter()


_API_ROUTER.register("lottery-wheel/spin", LotteryWheelSpinCRUDView, basename="lottery_wheel_spin")
_API_ROUTER.register("lottery-wheel", LotteryWheelCRUDView, basename="lottery_wheel")
_API_ROUTER.register("ticket", TicketCRUDView, basename="ticket")
_API_ROUTER.register("", LotteryCRUDView, basename="lottery")

urlpatterns = [
    path("api/v1/lotteries/", include(_API_ROUTER.urls)),
]
