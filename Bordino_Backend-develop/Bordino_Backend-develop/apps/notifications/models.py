from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.django_helper.models.base import AbstractBaseModel


class Category(models.TextChoices):
    """The three switches of «مدیریت اعلان‌ها»."""

    LOTTERY = "lottery", _("Lottery news")
    ACCOUNT = "account", _("Account notices")
    GAMES = "games", _("Games news")


class NotificationPreference(AbstractBaseModel):
    """What a player wants to hear about. Created on first read, everything on: a notification
    still needs a device the player allowed (PushSubscription)."""

    customer = models.OneToOneField(
        "users.Customer", on_delete=models.CASCADE, related_name="notification_preference"
    )
    lottery = models.BooleanField(default=True)
    account = models.BooleanField(default=True)
    games = models.BooleanField(default=True)

    class Meta(AbstractBaseModel.Meta):
        verbose_name = _("Notification preference")
        verbose_name_plural = _("Notification preferences")

    def __str__(self):
        return str(self.customer)

    def wants(self, category: str) -> bool:
        return bool(getattr(self, category, False))


class PushSubscription(AbstractBaseModel):
    """One device (browser / installed app) that agreed to receive Web Push notifications."""

    customer = models.ForeignKey(
        "users.Customer", on_delete=models.CASCADE, related_name="push_subscriptions"
    )
    endpoint = models.CharField(max_length=1000, unique=True)
    p256dh = models.CharField(max_length=200)
    auth = models.CharField(max_length=100)
    user_agent = models.CharField(max_length=300, blank=True)
    last_sent_at = models.DateTimeField(null=True, blank=True)

    class Meta(AbstractBaseModel.Meta):
        verbose_name = _("Push device")
        verbose_name_plural = _("Push devices")

    def __str__(self):
        return f"{self.customer} · {self.user_agent[:40]}"


class AppDevice(AbstractBaseModel):
    """The Android app on one phone, registered with Pushe (the app's WebView has no Web Push)."""

    class Provider(models.TextChoices):
        PUSHE = "pushe", "Pushe"

    customer = models.ForeignKey("users.Customer", on_delete=models.CASCADE, related_name="app_devices")
    provider = models.CharField(max_length=20, choices=Provider.choices, default=Provider.PUSHE)
    device_id = models.CharField(max_length=200)
    last_sent_at = models.DateTimeField(null=True, blank=True)

    class Meta(AbstractBaseModel.Meta):
        verbose_name = _("App device")
        verbose_name_plural = _("App devices")
        constraints = [models.UniqueConstraint(fields=("provider", "device_id"), name="app_device_once")]

    def __str__(self):
        return f"{self.customer} · {self.provider}"


class NotificationLog(AbstractBaseModel):
    """Every notification sent, once per (customer, key): a retried job or a second admin action
    does not notify twice."""

    customer = models.ForeignKey(
        "users.Customer", on_delete=models.CASCADE, related_name="notification_logs"
    )
    category = models.CharField(max_length=20, choices=Category.choices)
    key = models.CharField(max_length=120)
    title = models.CharField(max_length=200)
    body = models.CharField(max_length=500, blank=True)
    url = models.CharField(max_length=300, blank=True)
    delivered = models.PositiveIntegerField(default=0)

    class Meta(AbstractBaseModel.Meta):
        verbose_name = _("Notification sent")
        verbose_name_plural = _("Notifications sent")
        constraints = [
            models.UniqueConstraint(fields=("customer", "key"), name="notification_once_per_key")
        ]

    def __str__(self):
        return f"{self.customer}: {self.title}"
