from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.django_helper.models.base import AbstractBaseModel
from apps.users.models.customer import Customer


class ProfileReward(AbstractBaseModel):
    """The complete-profile reward, paid once per customer: the unique row is the proof, so no
    replay of the last onboarding step (or a stale save that moves the step back) pays twice."""

    class Meta(AbstractBaseModel.Meta):
        verbose_name = _("Profile reward")
        verbose_name_plural = _("Profile rewards")

    customer = models.OneToOneField(Customer, on_delete=models.CASCADE, related_name="profile_reward")
    points = models.PositiveIntegerField()

    def __str__(self):
        return f"{self.customer_id}: {self.points}"
