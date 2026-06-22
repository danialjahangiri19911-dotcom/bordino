import logging

import environ
import sentry_sdk
from sentry_sdk.integrations.celery import CeleryIntegration
from sentry_sdk.integrations.django import DjangoIntegration
from sentry_sdk.integrations.logging import LoggingIntegration
from sentry_sdk.integrations.redis import RedisIntegration

env = environ.Env()
environ.Env.read_env()


def init_sentry():
    SENTRY_DSN = env.str(
        "SENTRY_DSN",
        default="https://05fb9e719248a1c03126758e3524b924@sentry.karpelleh.com/2",
    )

    if SENTRY_DSN:
        IGNORED_ERRORS = [
            "rest_framework.exceptions.NotAuthenticated",
            "rest_framework.exceptions.AuthenticationFailed",
            "rest_framework.exceptions.NotFound",
            "django.http.Http404",
            "BrokenPipeError",
            "ConnectionResetError",
            "asyncio.exceptions.CancelledError",
        ]

        sentry_sdk.init(
            dsn=SENTRY_DSN,
            environment=env.str("ENV", default="production"),
            integrations=[
                DjangoIntegration(),
                CeleryIntegration(),
                RedisIntegration(),
                LoggingIntegration(
                    level=logging.INFO,
                    event_level=logging.ERROR,
                    sentry_logs_level=logging.INFO,
                ),
            ],
            traces_sample_rate=env.float("SENTRY_TRACES_SAMPLE_RATE", default=0.5),
            profiles_sample_rate=env.float("SENTRY_PROFILES_SAMPLE_RATE", default=1.0),
            send_default_pii=True,
            ignore_errors=IGNORED_ERRORS,
            before_send=lambda event, _hint: event,
            in_app_include=["apps", "config"],
            max_request_body_size="always",
            event_scrubber=None,
            enable_logs=True,
        )
