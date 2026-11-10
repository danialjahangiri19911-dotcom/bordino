from django.apps import AppConfig


class SpyConfig(AppConfig):
    name = "apps.spy"
    label = "spy"
    verbose_name = "جاسوس (بازی گروهی)"

    def ready(self):
        # (the admin's changes clear the cached settings at once: their signals live there)
        from apps.spy import services  # noqa: F401  pylint: disable=import-outside-toplevel,unused-import
