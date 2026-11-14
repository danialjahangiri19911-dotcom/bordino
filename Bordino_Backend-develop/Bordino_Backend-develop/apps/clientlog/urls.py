from django.urls import path

from apps.clientlog.views import ClientLogView

urlpatterns = [path("api/v1/client-log/", ClientLogView.as_view(), name="client_log")]
