from django.urls import path

from apps.crash.views import (
    ChickenCashoutView,
    ChickenConfigView,
    ChickenRoundsView,
    ChickenStepView,
    CrashCashoutView,
    CrashConfigView,
    CrashRoundsView,
    CrashSeedView,
    round_wait_view,
)

urlpatterns = [
    path("api/v1/games/crash/config/", CrashConfigView.as_view(), name="crash_config"),
    path("api/v1/games/crash/rounds/", CrashRoundsView.as_view(), name="crash_rounds"),
    path(
        "api/v1/games/crash/rounds/<uuid:round_id>/cashout/",
        CrashCashoutView.as_view(),
        name="crash_cashout",
    ),
    path("api/v1/games/crash/rounds/<uuid:round_id>/wait/", round_wait_view, name="crash_wait"),
    path("api/v1/games/crash/seed/", CrashSeedView.as_view(), name="crash_seed"),
    # The client seed is shared: change it through games/crash/seed/.
    path("api/v1/games/chicken/config/", ChickenConfigView.as_view(), name="chicken_config"),
    path("api/v1/games/chicken/rounds/", ChickenRoundsView.as_view(), name="chicken_rounds"),
    path(
        "api/v1/games/chicken/rounds/<uuid:round_id>/step/",
        ChickenStepView.as_view(),
        name="chicken_step",
    ),
    path(
        "api/v1/games/chicken/rounds/<uuid:round_id>/cashout/",
        ChickenCashoutView.as_view(),
        name="chicken_cashout",
    ),
]
