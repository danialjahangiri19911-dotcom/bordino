from django.conf import settings
from django.utils.crypto import get_random_string


def generate_random_code(length=settings.OTP_LENGTH):
    # Only a local debug build: a server missing DJANGO_ENV (default «dev») with DEBUG off still
    # sends real codes, never the known test one.
    if settings.ENVIRONMENT in ("dev", "local") and settings.DEBUG:
        return settings.DEFAULT_TEST_OTP
    return get_random_string(length=length, allowed_chars="0123456789")
