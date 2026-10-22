from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.django_helper.models.base import AbstractBaseModel


class ReferralRewardConfig(AbstractBaseModel):
    class Meta:
        verbose_name = _("Referral Reward Configuration")
        verbose_name_plural = _("Referral Reward Configurations")
        ordering = ["level"]

    level = models.PositiveSmallIntegerField(
        verbose_name=_("Referral Level"),
        help_text=_("1 for direct inviter, 2 for inviter's inviter, etc."),
        unique=True,
    )
    token_percentage = models.PositiveIntegerField(
        verbose_name=_("Token Reward Percentage"),
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        help_text=_("Percentage of required tokens to reward"),
    )
    is_active = models.BooleanField(verbose_name=_("Is Active"), default=True)

    def clean(self):
        super().clean()
        # All levels together may give away at most what the buyer paid.
        others = (
            ReferralRewardConfig.objects.filter(is_active=True)
            .exclude(pk=self.pk)
            .aggregate(total=models.Sum("token_percentage"))["total"]
            or 0
        )
        if self.is_active and others + self.token_percentage > 100:
            raise ValidationError(
                {"token_percentage": _("All active levels together cannot exceed 100%.")}
            )

    def __str__(self):
        return f"Level {self.level}: {self.token_percentage}% tokens"
