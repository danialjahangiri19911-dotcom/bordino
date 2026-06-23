from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
]
if settings.DEBUG:
    urlpatterns += [path("silk/", include("silk.urls", namespace="silk"))]
urlpatterns += [
    path("", include("apps.django_helper.swagger.urls")),
    path("", include("apps.user_management.urls")),
    path("", include("apps.wallet.urls")),
    path("", include("apps.lottery.urls")),
    path("", include("apps.entertainment.urls")),
    path("", include("apps.configuration.urls")),
]

if settings.DEBUG:
    from django.urls import re_path

    from main_app.media_serve import serve_media_with_range

    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
    # Range-capable media serving so the browser can seek in audio/video.
    urlpatterns += [
        re_path(
            r"^media/(?P<path>.*)$",
            serve_media_with_range,
            {"document_root": settings.MEDIA_ROOT},
        ),
    ]
