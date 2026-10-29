from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.contrib.auth.validators import UnicodeUsernameValidator
from django.core import validators
from django.db import models
from django.utils.deconstruct import deconstructible
from django.utils.translation import gettext_lazy as _

from apps.django_helper.models.base import AbstractBaseModel
from apps.users.models.user_manager import UserManager

username_validator = UnicodeUsernameValidator()

_DIGITS = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")


def canonical_phone(text) -> str:
    """The one form a mobile number is stored and looked up in: ASCII digits, without the country
    or trunk prefix («+98 912…», «0098…», «0912…», «۹۱۲…» → «912…»). Without this, «۹۱۲…» and
    «912…» were two accounts (and two sets of per-phone limits and rewards) for one SIM."""
    digits = "".join(ch for ch in str(text or "").translate(_DIGITS) if ch in "0123456789")
    if digits.startswith("0098"):
        digits = digits[4:]
    elif digits.startswith("98") and len(digits) == 12:
        digits = digits[2:]
    elif digits.startswith("0") and len(digits) == 11:
        digits = digits[1:]
    return digits


@deconstructible
class PhoneNumberValidator(validators.RegexValidator):
    # ASCII digits only (\d would also accept Persian digits: another spelling of the same number).
    regex = r"^(9[0-9]*)$"
    message = _("Use a digit number starting with 9.")
    flags = 0


# TODO: Follow endpoint behavior


class User(AbstractBaseModel, AbstractBaseUser, PermissionsMixin):
    class Meta(AbstractBaseModel.Meta):
        verbose_name = _("User")
        verbose_name_plural = _("Users")

    phone_number = models.CharField(
        verbose_name=_("phone number"),
        max_length=10,
        unique=True,
        validators=[PhoneNumberValidator()],
    )
    username = models.CharField(
        verbose_name=_("username"),
        max_length=150,
        unique=True,
        blank=True,
        null=True,
        help_text=_("Required. 150 characters or fewer. Letters, digits and @/./+/-/_ only."),
        validators=[username_validator],
        error_messages={
            "unique": _("A user with that username already exists."),
        },
    )
    is_admin = models.BooleanField(verbose_name=_("Is Admin"), default=False)
    is_active = models.BooleanField(verbose_name=_("Is Active"), default=True)

    USERNAME_FIELD = "phone_number"

    objects = UserManager()

    @property
    def is_staff(self):
        return self.is_admin

    @property
    def is_customer(self):
        return hasattr(self, "customer")

    @property
    def is_sponsor(self):
        return hasattr(self, "sponsor")

    def __str__(self):
        if self.username:
            return f"{self.phone_number}-{self.username}"
        return self.phone_number

    def normalize_phone_number(self):
        if self.phone_number:
            self.phone_number = canonical_phone(self.phone_number)

    def save(self, *args, **kwargs):
        self.normalize_phone_number()
        super().save(*args, **kwargs)
