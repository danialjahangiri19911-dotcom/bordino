from django.urls import path

from apps.spy.views import SpyConfigView

urlpatterns = [
    path("api/v1/games/spy/config/", SpyConfigView.as_view(), name="spy_config"),
]
