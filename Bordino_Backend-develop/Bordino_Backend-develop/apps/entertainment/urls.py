from django.urls import path

from apps.entertainment.views.fortune_reading import RandomFortuneReadingView
from apps.entertainment.views.tarot import TarotDrawView

urlpatterns = [
    path(
        "api/v1/entertainment/fortune-reading/",
        RandomFortuneReadingView.as_view(),
        name="fortune_reading",
    ),
    path(
        "api/v1/entertainment/tarot/",
        TarotDrawView.as_view(),
        name="tarot_draw",
    ),
]
