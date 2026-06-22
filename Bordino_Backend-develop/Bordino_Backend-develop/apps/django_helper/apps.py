from django.apps import AppConfig


class DjangoHelperConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.django_helper"

    def ready(self):
        # pylint: disable=import-outside-toplevel
        # pylint: disable=unused-import
        from apps.django_helper.drf.monkey_patching import disable_put_method  # noqa
