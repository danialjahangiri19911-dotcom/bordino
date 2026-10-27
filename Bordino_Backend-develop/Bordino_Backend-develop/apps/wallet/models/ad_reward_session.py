from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.django_helper.models.base import AbstractBaseModel


class AdRewardSession(AbstractBaseModel):
    """One rewarded-ad view offered before a game: started by the app, rewarded at most once, and
    only when the ad provider's completion check passes on the server (services/ad_reward.py)."""

    class Status(models.TextChoices):
        STARTED = "started", _("Started")
        REWARDED = "rewarded", _("Rewarded")

    customer = models.ForeignKey(
        "users.Customer", on_delete=models.CASCADE, related_name="ad_reward_sessions"
    )
    provider = models.CharField(max_length=30)
    # Where the offer was shown (the game the player picked), for reports.
    placement = models.CharField(max_length=50, blank=True)
    # Copied from the configuration when the session starts: a later change applies to new views.
    reward_points = models.PositiveIntegerField()
    min_watch_seconds = models.PositiveIntegerField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.STARTED)
    completed_at = models.DateTimeField(null=True, blank=True)
    activity_transaction = models.OneToOneField(
        "wallet.ActivityTransaction",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="ad_reward_session",
    )

    class Meta(AbstractBaseModel.Meta):
        verbose_name = _("Rewarded ad view")
        verbose_name_plural = _("Rewarded ad views")
        indexes = [models.Index(fields=["customer", "status", "completed_at"])]

    def __str__(self):
        return f"{self.provider}/{self.placement}: {self.customer} ({self.status})"
