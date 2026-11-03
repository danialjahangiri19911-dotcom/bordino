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
    path("api/v1/missions/callback/<uuid:mission_id>/", MissionCallbackView.as_view(), name="mission_callback"),
]
