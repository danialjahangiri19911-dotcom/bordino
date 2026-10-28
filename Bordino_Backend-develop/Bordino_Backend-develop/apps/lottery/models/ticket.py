from django.contrib.postgres.fields import ArrayField
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.django_helper.models.base import AbstractBaseModel
from apps.lottery.models import Lottery
from apps.users.models import Customer


class Ticket(AbstractBaseModel):
    class Status(models.TextChoices):
        ACTIVE = "active", _("Active")
        WINNER = "winner", _("Winner")
        EXPIRED = "expired", _("Expired")

    class Meta(AbstractBaseModel.Meta):
        verbose_name = _("Ticket")
        verbose_name_plural = _("Tickets")
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["lottery", "customer"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["lottery", "customer", "numbers"],
                name="unique_lottery_customer_numbers",
            )
        ]

    name = models.CharField(verbose_name=_("name"), max_length=100)
    lottery = models.ForeignKey(
        Lottery,
        on_delete=models.CASCADE,
        related_name="tickets",
        verbose_name=_("lottery"),
    )
    customer = models.ForeignKey(
        Customer,
        on_delete=models.CASCADE,
        related_name="ticket_customers",
        verbose_name=_("customer"),
    )
    numbers = ArrayField(
        models.IntegerField(validators=[MinValueValidator(1), MaxValueValidator(100)]),
        size=6,
        null=True,
        blank=True,
        help_text="An array of 6 integers, each between 1 and 100",
    )
    status = models.CharField(
        verbose_name=_("Status"),
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
    )

    matched_numbers = models.PositiveSmallIntegerField(null=True, blank=True)
    prize_amount = models.DecimalField(max_digits=20, decimal_places=0, null=True, blank=True)

    def __str__(self):
        return f"{self.name} - {self.lottery.name}"

    def save(self, *args, **kwargs):
        # One order per combination (matching ignores order), so the unique constraint and the
        # duplicate check see 6,5,4,3,2,1 and 1,2,3,4,5,6 as the same ticket, whatever wrote it.
        if self.numbers:
            self.numbers = sorted(self.numbers)
        super().save(*args, **kwargs)

    def clean(self):
        super().clean()
        if self.numbers and len(self.numbers) != 6:
            raise ValidationError(_("The 'numbers' field must contain exactly 6 integers."))
        # Six DIFFERENT numbers from the draw's range: «1,1,1,1,1,1» would match six times.
        from apps.lottery.services.lottery.draw import HIGHEST_NUMBER  # pylint: disable=import-outside-toplevel

        if self.numbers and (len(set(self.numbers)) != 6 or not all(1 <= n <= HIGHEST_NUMBER for n in self.numbers)):
            raise ValidationError(_("A ticket needs six different numbers between 1 and %(n)s.") % {"n": HIGHEST_NUMBER})

    @property
    def is_winner(self):
        """Check if ticket is a winner"""
        return self.status == self.Status.WINNER

    @property
    def is_expired(self):
        """Check if ticket is expired"""
        return self.status == self.Status.EXPIRED
