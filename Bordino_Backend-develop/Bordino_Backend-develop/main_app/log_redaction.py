"""Secrets in request addresses never reach the logs.

The Adivery reward-confirmation address carries the secret that pays rewards
(/api/v1/wallet/ad-reward/adivery/<secret>/). The app server's access log (gunicorn + uvicorn) and
Django's request warnings («Not Found: <path>») print request paths: this filter replaces the secret with
<secret> in every record, before any handler writes it.
"""

import logging
import re

SECRET_IN_PATH = re.compile(r"(adivery/)[A-Za-z0-9_-]{16,}")

# Loggers that print request addresses (their records are filtered where they are made).
PATH_LOGGERS = ("uvicorn.access", "uvicorn.error", "gunicorn.access", "gunicorn.error", "django.request", "django.server")


class RedactSecrets(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        try:
            message = record.getMessage()
        except Exception:  # pylint: disable=broad-except
            return True
        if "adivery/" in message:
            masked = SECRET_IN_PATH.sub(r"\1<secret>", message)
            if masked != message:
                record.msg, record.args = masked, None
        return True


def install():
    """On the loggers that print paths, and on every handler they and the root logger write through."""
    f = RedactSecrets()
    for name in PATH_LOGGERS + ("",):
        logger = logging.getLogger(name)
        if not any(isinstance(x, RedactSecrets) for x in logger.filters):
            logger.addFilter(f)
        for handler in logger.handlers:
            if not any(isinstance(x, RedactSecrets) for x in handler.filters):
                handler.addFilter(f)
