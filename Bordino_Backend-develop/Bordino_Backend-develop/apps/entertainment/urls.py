from django.urls import path

from apps.entertainment.views.fortune_reading import RandomFortuneReadingView

urlpatterns = [
    path(
        "api/v1/entertainment/fortune-reading/",
        RandomFortuneReadingView.as_view(),
        name="fortune_reading",
    ),
]
