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


def _mask(value):
    return SECRET_IN_PATH.sub(r"\1<secret>", value) if isinstance(value, str) and "adivery/" in value else value


class RedactSecrets(logging.Filter):
    """Masks the message and each of its arguments in place, keeping the record's shape: formatters that
    read the arguments themselves (uvicorn's access formatter unpacks them) keep working."""

    def filter(self, record: logging.LogRecord) -> bool:
        try:
            if isinstance(record.args, tuple):
                record.args = tuple(_mask(a) for a in record.args)
            elif isinstance(record.args, dict):
                record.args = {k: _mask(v) for k, v in record.args.items()}
            record.msg = _mask(record.msg)
            message = record.getMessage()
        except Exception:  # pylint: disable=broad-except
            return True
        if "adivery/" in message and SECRET_IN_PATH.search(message):
            # (the secret came in some other way, e.g. a formatted object): the whole text, as a last resort
            record.msg, record.args = SECRET_IN_PATH.sub(r"\1<secret>", message), None
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
