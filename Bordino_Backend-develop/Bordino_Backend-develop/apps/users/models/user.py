from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.contrib.auth.validators import UnicodeUsernameValidator
from django.core import validators
from django.db import models
from django.utils.deconstruct import deconstructible
from django.utils.translation import gettext_lazy as _

from apps.django_helper.models.base import AbstractBaseModel
from apps.users.models.user_manager import UserManager

username_validator = UnicodeUsernameValidator()


@deconstructible
class PhoneNumberValidator(validators.RegexValidator):
    regex = r"^(9\d*)$"
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
            self.phone_number = "".join(filter(str.isdigit, self.phone_number))

    def save(self, *args, **kwargs):
        self.normalize_phone_number()
        super().save(*args, **kwargs)
