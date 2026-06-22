from django.apps import AppConfig
from django.db.models.signals import post_delete, post_save


class ConfigurationConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.configuration"

    def ready(self):
        from apps.configuration.models import SystemConfiguration

        for signal in (post_save, post_delete):
            signal.connect(
                lambda sender, instance, **kwargs: SystemConfiguration.objects.invalidate(
                    instance=instance
                ),
                sender=SystemConfiguration,
            )
