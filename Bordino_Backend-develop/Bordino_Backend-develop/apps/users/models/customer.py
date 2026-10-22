from django.core.exceptions import ValidationError
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.django_helper.models.base import AbstractBaseModel
from apps.users.models.category import Category
from apps.users.models.dailyusage import DailyUsage
from apps.users.models.file import File
from apps.users.models.signup_reason import SignupReason
from apps.users.models.user import User


def validate_signup_reason(value):
    valid_reasons = [reason[0] for reason in Customer.SignupReason.choices]
    for reason in value:
        if reason not in valid_reasons:
            raise ValidationError(f"Invalid signup reason: {reason}")


# TODO: Follow endpoint behavior


class Customer(AbstractBaseModel):
    class Meta(AbstractBaseModel.Meta):
        verbose_name = _("Customer")
        verbose_name_plural = _("Customers")

    class Gender(models.TextChoices):
        MALE = "M", _("Male")
        FEMALE = "F", _("Female")
        UNSET = "MF", _("Unset")

    class Step(models.TextChoices):
        REGISTRATION = "Registration", _("Registration")
        OTP_VERIFICATION = "OtpVerification", _("OTP Verification")
        PROFILE_SETUP = "ProfileSetup", _("Profile Setup")
        DAILY_USAGE_TIME = "DailyUsageTime", _("Daily Usage Time")
        USAGE_GOAL = "UsageGoal", "Usage Goal"
        INTEREST_SELECTION = "InterestSelection", _("Interest Selection")
        # After interest selection. Each step value means "the next step to do", so the last
        # step needs its own "done" value, or it could never be submitted (or be submitted twice).
        COMPLETED = "Completed", _("Completed")

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="customer")
    gender = models.CharField(
        verbose_name=_("gender"),
        max_length=2,
        choices=Gender.choices,
        default=Gender.UNSET,
    )
    birthdate = models.DateField(verbose_name=_("birthdate"), null=True, blank=True)
    favorite_categories = models.ManyToManyField(
        Category,
        null=True,
        blank=True,
        verbose_name=_("favorite categories"),
        related_name="category_customers",
    )
    image = models.ForeignKey(
        File,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name=_("image"),
        related_name="customer_images",
    )
    registration_step = models.CharField(
        verbose_name=_("registration step"),
        max_length=20,
        choices=Step.choices,
        default=Step.OTP_VERIFICATION,
    )
    invited_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name=_("invited by"),
        related_name="invited_customers",
    )
    referral_code = models.CharField(
        verbose_name=_("referral code"),
        max_length=20,
        unique=True,
        null=True,
        blank=True,
        db_index=True,
    )
    consecutive_active_days = models.IntegerField(
        verbose_name=_("consecutive active days"), default=0
    )
    max_consecutive_days = models.IntegerField(verbose_name=_("max consecutive days"), default=0)
    last_active_date = models.DateTimeField(
        verbose_name=_("last active date"), null=True, blank=True
    )
    daily_usage_minutes = models.ForeignKey(
        DailyUsage,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name=_("daily usage minutes"),
        related_name="daily_usage_customers",
    )

    signup_reasons = models.ManyToManyField(
        SignupReason,
        blank=True,
        verbose_name=_("signup reasons"),
        related_name="signup_reason_customers",
    )

    @property
    def referral_count(self):
        return self.user.invited_customers.count()

    def __str__(self):
        return self.user.phone_number
