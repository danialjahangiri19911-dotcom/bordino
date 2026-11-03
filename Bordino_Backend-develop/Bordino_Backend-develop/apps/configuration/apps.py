from django.apps import AppConfig
from django.db import transaction
from django.db.models.signals import post_delete, post_save


def _invalidate(sender, instance, using=None, **kwargs):
    # Now, and again once the save is committed: a read between the two would otherwise cache the
    # old committed value for an hour.
    sender.objects.invalidate(instance=instance)
    transaction.on_commit(lambda: sender.objects.invalidate(instance=instance), using=using)


class ConfigurationConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.configuration"

    def ready(self):
        from apps.configuration.models import SystemConfiguration

        # A module-level receiver: signals keep only a weak reference, and a lambda made here was
        # collected at once, so an admin's save never cleared the cached value (up to an hour).
        for signal in (post_save, post_delete):
            signal.connect(_invalidate, sender=SystemConfiguration, dispatch_uid=f"config-invalidate-{signal is post_save}")
