from django.apps import AppConfig


class WalletConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.wallet"

    def ready(self):
        import apps.wallet.signals  # noqa: F401

        # The app server's own loggers (gunicorn/uvicorn access lines) are set up outside Django's
        # LOGGING: the secret in the Adivery address is masked on them too.
        from main_app.log_redaction import install  # pylint: disable=import-outside-toplevel

        install()
