from django.urls import path

from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView

urlpatterns = (
    path("schema/", SpectacularAPIView.as_view(), name="api_schema"),
    path(
        "swagger/",
        SpectacularSwaggerView.as_view(url_name="api_schema"),
        name="api_schema_swagger_ui",
    ),
    path("redoc/", SpectacularRedocView.as_view(url_name="api_schema"), name="api_schema_redoc"),
)
