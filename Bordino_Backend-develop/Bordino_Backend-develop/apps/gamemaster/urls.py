from django.urls import path

from apps.gamemaster.views import (
    AnalyticsView,
    DashboardView,
    GameActionView,
    GameBoardView,
    GamesView,
    GameView,
    PayVerifyView,
    PayView,
    PreviewView,
    OptionsView,
    ProfileView,
    QrView,
    ShareView,
    TemplatesView,
    UploadView,
)

urlpatterns = [
    path("api/v1/gm/profile/", ProfileView.as_view(), name="gm_profile"),
    path("api/v1/gm/templates/", TemplatesView.as_view(), name="gm_templates"),
    path("api/v1/gm/dashboard/", DashboardView.as_view(), name="gm_dashboard"),
    path("api/v1/gm/uploads/", UploadView.as_view(), name="gm_upload"),
    path("api/v1/gm/games/", GamesView.as_view(), name="gm_games"),
    path("api/v1/gm/games/<uuid:game_id>/", GameView.as_view(), name="gm_game"),
    path("api/v1/gm/games/<uuid:game_id>/preview/", PreviewView.as_view(), name="gm_preview"),
    path("api/v1/gm/games/<uuid:game_id>/qr/", QrView.as_view(), name="gm_qr"),
    path("api/v1/gm/games/<uuid:game_id>/share/", ShareView.as_view(), name="gm_share"),
    path("api/v1/gm/games/<uuid:game_id>/analytics/", AnalyticsView.as_view(), name="gm_analytics"),
    path("api/v1/gm/payments/verify/", PayVerifyView.as_view(), name="gm_pay_verify"),
    path("api/v1/gm/games/<uuid:game_id>/pay/", PayView.as_view(), name="gm_pay"),
    path("api/v1/gm/options/", OptionsView.as_view(), name="gm_options"),
    path("api/v1/gm/games/<uuid:game_id>/leaderboard/", GameBoardView.as_view(), name="gm_board"),
    path("api/v1/gm/games/<uuid:game_id>/<str:action>/", GameActionView.as_view(), name="gm_action"),
]
