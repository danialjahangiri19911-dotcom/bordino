from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _


def uppercase_validator(value):
    if value != value.upper():
        raise ValidationError(_("The symbol must be in uppercase."))
