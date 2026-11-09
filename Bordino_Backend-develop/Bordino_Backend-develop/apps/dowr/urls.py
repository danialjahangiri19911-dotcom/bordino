from django.urls import path

from apps.dowr.views import DowrConfigView, DowrGamesView

urlpatterns = [
    path("api/v1/games/dowr/config/", DowrConfigView.as_view(), name="dowr_config"),
    path("api/v1/games/dowr/games/", DowrGamesView.as_view(), name="dowr_games"),
]
