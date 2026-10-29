from django.db import models
from django.utils.translation import gettext_lazy as _


class RevokedSession(models.Model):
    """A login session ended by logout. Every token of that session — the refresh token and every
    access/refresh pair rotated from it, wherever a copy of it went — stops working."""

    sid = models.CharField(max_length=32, unique=True)
    revoked_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _("Revoked session")
        verbose_name_plural = _("Revoked sessions")

    def __str__(self):
        return self.sid
