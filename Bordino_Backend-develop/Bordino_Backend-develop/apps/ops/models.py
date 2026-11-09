"""«بردینو ادمین»: who may use the admin app (members; the owners come from settings.OPS_OWNERS) and
what each of them did there (the audit log). Roles are Django groups (apps.ops.roles)."""

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.django_helper.models.base import AbstractBaseModel


class OpsMember(AbstractBaseModel):
    """A staff member of the admin app: signs in with an SMS code; their roles are their groups."""

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="ops_member")
    is_active = models.BooleanField(default=True, verbose_name=_("فعال"))
    added_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+", verbose_name=_("افزوده توسط")
    )
    note = models.CharField(max_length=200, blank=True, verbose_name=_("یادداشت"))

    class Meta(AbstractBaseModel.Meta):
        verbose_name = _("عضو اپ ادمین")
        verbose_name_plural = _("اعضای اپ ادمین")

    def __str__(self):
        return str(self.user)


class OpsAuditLog(AbstractBaseModel):
    """One action in the admin app (a decision, a payout, a setting, a staff change): kept for good."""

    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    action = models.CharField(max_length=60)
    target_type = models.CharField(max_length=40, blank=True)
    target_id = models.CharField(max_length=64, blank=True)
    data = models.JSONField(default=dict, blank=True)
    ip = models.GenericIPAddressField(null=True, blank=True)

    class Meta(AbstractBaseModel.Meta):
        verbose_name = _("رویداد اپ ادمین")
        verbose_name_plural = _("سابقهٔ اپ ادمین")
        indexes = [models.Index(fields=["action", "create_time"], name="ops_audit_action")]

    def __str__(self):
        return f"{self.action} {self.target_type}:{self.target_id}"
