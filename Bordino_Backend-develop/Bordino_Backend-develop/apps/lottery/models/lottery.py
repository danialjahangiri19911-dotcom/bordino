from django.contrib.postgres.fields import ArrayField
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from apps.django_helper.models.base import AbstractBaseModel
from apps.users.models import Sponsor
from apps.wallet.models import Token


class Lottery(AbstractBaseModel):
    class Status(models.TextChoices):
        DRAFT = "draft", _("Draft")
        ACTIVE = "active", _("Active")
        COMPLETED = "completed", _("Completed")
        CANCELLED = "cancelled", _("Cancelled")

    class Meta(AbstractBaseModel.Meta):
        verbose_name = _("Lottery")
        verbose_name_plural = _("Lotteries")
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["start_date", "end_date"]),
        ]

    name = models.CharField(verbose_name=_("name"), max_length=20)
    owner = models.ForeignKey(Sponsor, verbose_name=_("Owner"), on_delete=models.CASCADE)
    token = models.ForeignKey(
        Token,
        blank=False,
        verbose_name=_("Token"),
        related_name="lotteries",
        on_delete=models.CASCADE,
        null=True,
    )
    balance = models.DecimalField(
        verbose_name=_("Balance"), max_digits=20, decimal_places=0, default=0
    )
    numbers = ArrayField(
        models.IntegerField(validators=[MinValueValidator(1), MaxValueValidator(100)]),
        size=6,
        help_text="An array of 6 integers, each between 1 and 100",
    )
    ticket_price = models.DecimalField(
        verbose_name=_("ticket_price"), max_digits=20, decimal_places=0, default=0
    )
    status = models.CharField(
        verbose_name=_("Status"),
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
    )
    start_date = models.DateTimeField(
        verbose_name=_("Start Date"),
        null=True,
        blank=True,
    )
    end_date = models.DateTimeField(
        verbose_name=_("End Date"),
        null=True,
        blank=True,
    )

    def __str__(self):
        return self.name

    def clean(self):
        super().clean()
        if self.start_date and self.end_date and self.start_date >= self.end_date:
            raise ValidationError(_("End date must be after start date"))

        if self.status == self.Status.ACTIVE:
            if not self.start_date or not self.end_date:
                raise ValidationError(_("Active lotteries must have start and end dates"))
            if self.start_date > timezone.now():
                raise ValidationError(_("Start date cannot be in the future"))
            if self.end_date <= timezone.now():
                raise ValidationError(_("End date must be in the future"))

    @property
    def is_active(self):
        """Check if lottery is currently active"""
        return (
            self.status == self.Status.ACTIVE
            and self.start_date <= timezone.now()
            and self.end_date > timezone.now()
        )

    @property
    def total_tickets(self):
        """Get total number of tickets sold"""
        return self.tickets.count()

    @property
    def total_prize_pool(self):
        """Calculate total prize pool"""
        return self.ticket_price * self.total_tickets
