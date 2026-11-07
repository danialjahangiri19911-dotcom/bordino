from django.urls import path

from apps.missions.views import (
    MissionCallbackView,
    MissionClaimView,
    MissionListView,
    MissionOpenedView,
    MissionProofView,
    MissionQrHoldView,
    MissionQrView,
    MissionStartView,
    MysteryCheckinView,
    MysteryDetailView,
    MysteryHintView,
    MysteryStartView,
    VenueDisplayView,
)

urlpatterns = [
    path("api/v1/missions/", MissionListView.as_view(), name="missions"),
    path("api/v1/missions/<uuid:mission_id>/start/", MissionStartView.as_view(), name="mission_start"),
    path("api/v1/missions/attempts/<uuid:attempt_id>/claim/", MissionClaimView.as_view(), name="mission_claim"),
    path("api/v1/missions/attempts/<uuid:attempt_id>/opened/", MissionOpenedView.as_view(), name="mission_opened"),
    path("api/v1/missions/attempts/<uuid:attempt_id>/proof/", MissionProofView.as_view(), name="mission_proof"),
    path("api/v1/missions/qr/<str:token>/", MissionQrView.as_view(), name="mission_qr"),
    path("api/v1/missions/qr/<str:token>/hold/", MissionQrHoldView.as_view(), name="mission_qr_hold"),
    path("api/v1/missions/venue/<str:key>/", VenueDisplayView.as_view(), name="mission_venue"),
    path("api/v1/missions/mysteries/<uuid:mystery_id>/", MysteryDetailView.as_view(), name="mystery"),
    path("api/v1/missions/mysteries/<uuid:mystery_id>/start/", MysteryStartView.as_view(), name="mystery_start"),
    path(
        "api/v1/missions/mysteries/<uuid:mystery_id>/steps/<uuid:step_id>/checkin/",
        MysteryCheckinView.as_view(),
        name="mystery_checkin",
    ),
    path(
        "api/v1/missions/mysteries/<uuid:mystery_id>/steps/<uuid:step_id>/hint/",
        MysteryHintView.as_view(),
        name="mystery_hint",
    ),
    path("api/v1/missions/callback/<uuid:mission_id>/", MissionCallbackView.as_view(), name="mission_callback"),
]
