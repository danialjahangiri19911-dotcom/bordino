from django.conf import settings
from django.utils.crypto import get_random_string


def generate_random_code(length=settings.OTP_LENGTH):
    if settings.ENVIRONMENT in ("dev", "local"):
        return settings.DEFAULT_TEST_OTP
    return get_random_string(length=length, allowed_chars="0123456789")
