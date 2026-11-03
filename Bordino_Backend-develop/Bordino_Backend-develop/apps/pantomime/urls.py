from django.urls import path

from apps.pantomime.views import PantomimeConfigView, PantomimeGamesView

urlpatterns = [
    path("api/v1/games/pantomime/config/", PantomimeConfigView.as_view(), name="pantomime_config"),
    path("api/v1/games/pantomime/games/", PantomimeGamesView.as_view(), name="pantomime_games"),
]
