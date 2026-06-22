from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.configuration.views.game import GameConfigurationCRUDView

router = DefaultRouter()
router.register(
    "api/v1/game/configuration",
    GameConfigurationCRUDView,
    basename="game-configuration",
)

urlpatterns = [
    path("", include(router.urls)),
]
