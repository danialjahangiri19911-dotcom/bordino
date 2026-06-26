import datetime
import json
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured

import environ

env = environ.Env()
environ.Env.read_env()


def get_env_value(env_variable, default_value=None):
    try:
        return env.get_value(env_variable)
    except ImproperlyConfigured as err:
        if default_value is not None:
            return default_value

        error_msg = f"Please set the {env_variable} environment variable"
        raise ImproperlyConfigured(error_msg) from err


# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = get_env_value("SECRET_KEY")

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = json.loads(get_env_value("DEBUG"))

ALLOWED_HOSTS = get_env_value("ALLOWED_HOSTS", "*").replace(", ", ",").replace(" ,", ",").split(",")

CSRF_TRUSTED_ORIGINS = (
    get_env_value("CSRF_TRUSTED_ORIGINS").replace(", ", ",").replace(" ,", ",").split(",")
)


# Application definition
LOCAL_APPS = [
    "apps.django_helper.apps.DjangoHelperConfig",
    "apps.users.apps.UsersConfig",
    "apps.user_management.apps.UserManagementConfig",
    "apps.tasks.apps.TasksConfig",
    "apps.wallet.apps.WalletConfig",
    "apps.lottery.apps.LotteryConfig",
    "apps.entertainment.apps.EntertainmentConfig",
    "apps.configuration.apps.ConfigurationConfig",
]

THIRD_PARTY_APPS = [
    "corsheaders",
    "rest_framework",
    "drf_spectacular",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "django_celery_beat",
    "import_export",
]

if DEBUG:
    THIRD_PARTY_APPS += ["silk"]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    *THIRD_PARTY_APPS,
    *LOCAL_APPS,
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",  # CORS Django Headers
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]
if DEBUG:
    MIDDLEWARE.insert(0, "silk.middleware.SilkyMiddleware")

ROOT_URLCONF = "main_app.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ]
        },
    }
]

WSGI_APPLICATION = "main_app.wsgi.application"

# Database
DB_TYPE = get_env_value("DB_TYPE")
if DB_TYPE == "postgres":
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql_psycopg2",
            "NAME": get_env_value("DB_NAME"),
            "USER": get_env_value("DB_USER"),
            "PASSWORD": get_env_value("DB_PASSWORD"),
            "HOST": get_env_value("DB_HOST"),
            "PORT": get_env_value("DB_PORT"),
        }
    }
elif DB_TYPE == "sqlite3":
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / f"{get_env_value('DB_NAME')}.sqlite3",
        }
    }
else:
    raise ImproperlyConfigured("Invalid DB_TYPE")


# Password validation
# https://docs.djangoproject.com/en/3.0/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

AUTH_USER_MODEL = "users.User"

# Internationalization
# https://docs.djangoproject.com/en/3.0/topics/i18n/

LANGUAGE_CODE = get_env_value("LANGUAGE_CODE", default_value="en-us")
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True
LOCALE_PATHS = (BASE_DIR / "locale",)

# Static files (CSS, JavaScript, Images)
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "static"

# Media files (Uploaded files)
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

_raw_use_minio = get_env_value("USE_MINIO", default_value="False")
try:
    USE_MINIO = json.loads(_raw_use_minio) if (_raw_use_minio and _raw_use_minio.strip()) else False
except json.JSONDecodeError:
    USE_MINIO = False
if USE_MINIO:
    MINIO_ACCESS_KEY = get_env_value("MINIO_ACCESS_KEY")
    MINIO_SECRET_KEY = get_env_value("MINIO_SECRET_KEY")
    MINIO_BUCKET_NAME = get_env_value("MINIO_BUCKET_NAME")
    MINIO_ENDPOINT_URL = get_env_value("MINIO_ENDPOINT_URL")
    MINIO_REGION = get_env_value("MINIO_REGION", default_value="us-east-1")
    STORAGES = {
        "default": {
            "BACKEND": "storages.backends.s3boto3.S3Boto3Storage",
            "OPTIONS": {
                "access_key": MINIO_ACCESS_KEY,
                "secret_key": MINIO_SECRET_KEY,
                "bucket_name": MINIO_BUCKET_NAME,
                "endpoint_url": MINIO_ENDPOINT_URL,
                "region_name": MINIO_REGION,
                "custom_domain": False,
                "file_overwrite": False,
            },
        },
        "staticfiles": {
            "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
        },
    }
    MEDIA_URL = get_env_value(
        "MINIO_MEDIA_URL",
        default_value=f"{MINIO_ENDPOINT_URL.rstrip('/')}/{MINIO_BUCKET_NAME}/",
    )
else:
    STORAGES = {
        "default": {
            "BACKEND": "django.core.files.storage.FileSystemStorage",
            "OPTIONS": {"location": MEDIA_ROOT},
        },
        "staticfiles": {
            "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
        },
    }

# Default primary key field type
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Email
EMAIL_USE_TLS = get_env_value("EMAIL_USE_TLS")
EMAIL_HOST = get_env_value("EMAIL_HOST")
EMAIL_PORT = int(get_env_value("EMAIL_PORT"))
EMAIL_HOST_USER = get_env_value("EMAIL_HOST_USER")
EMAIL_HOST_PASSWORD = get_env_value("EMAIL_HOST_PASSWORD")
DEFAULT_FROM_EMAIL = get_env_value("DEFAULT_FROM_EMAIL")

# DRF
REST_FRAMEWORK = {
    "DEFAULT_FILTER_BACKENDS": ["django_filters.rest_framework.DjangoFilterBackend"],
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_RENDERER_CLASSES": (
        "apps.django_helper.drf.responses.custom_json.CustomJSONRenderer",
        "rest_framework.renderers.BrowsableAPIRenderer",
    ),
    "EXCEPTION_HANDLER": "apps.django_helper.drf.exceptions.handler.custom_exception_handler",
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_PAGINATION_CLASS": "apps.django_helper.drf.pagination.custom_page_number.CustomPageNumberPagination",
    "PAGE_SIZE": 20,
}

# Log
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "[{levelname}] [{asctime}] [{module}] [{process:d}] [{thread:d}] {message}",
            "style": "{",
        },
        "simple": {"format": "[{levelname}] {message}", "style": "{"},
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "simple",
            "level": "DEBUG",
        }
    },
    "loggers": {"": {"handlers": ["console"], "propagate": True, "level": "DEBUG"}},
}


APP_DOMAIN = env("APP_DOMAIN", default="http://localhost:8000")

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# DRF Spectacular Swagger
SPECTACULAR_SETTINGS = {
    "TITLE": get_env_value("SPECTACULAR_SETTINGS_TITLE"),
    "VERSION": get_env_value("SPECTACULAR_SETTINGS_VERSION", default_value="1.0.0"),
    "SCHEMA_PATH_PREFIX": r".*/api/v[0-9]",
}


# CORS Django Headers
CORS_ALLOWED_ORIGINS = (
    get_env_value("CORS_ALLOWED_ORIGINS").replace(", ", ",").replace(" ,", ",").split(",")
)

# JWT Settings

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": datetime.timedelta(hours=1),  # 1-hour token
    "REFRESH_TOKEN_LIFETIME": datetime.timedelta(days=14),  # 7-day refresh token
    "BLACKLIST_AFTER_ROTATION": True,
    "ROTATE_REFRESH_TOKENS": True,
}

# CACHES

CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": get_env_value("REDIS_LOCATION", default_value="redis://127.0.0.1:6379/1"),
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
        },
    }
}

ENVIRONMENT = get_env_value("DJANGO_ENV", default_value="dev")

if ENVIRONMENT == "prod":
    DEBUG = False

    CORS_ALLOW_ALL_ORIGINS = False

    CORS_ORIGIN_WHITELIST = (
        get_env_value("CORS_ORIGIN_WHITELIST").replace(", ", ",").replace(" ,", ",").split(",")
    )

    SESSION_COOKIE_SECURE = get_env_value("SESSION_COOKIE_SECURE", default_value=True)

    # https://docs.djangoproject.com/en/dev/ref/settings/#secure-proxy-ssl-header
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    # https://docs.djangoproject.com/en/dev/ref/settings/#secure-ssl-redirect
    SECURE_SSL_REDIRECT = get_env_value("SECURE_SSL_REDIRECT", default_value=True)
    # https://docs.djangoproject.com/en/dev/ref/middleware/#x-content-type-options-nosniff
    SECURE_CONTENT_TYPE_NOSNIFF = get_env_value("SECURE_CONTENT_TYPE_NOSNIFF", default_value=True)


KAVENEGAR_API_KEY = get_env_value("KAVENEGAR_API_KEY")

CACHE_KEY_PREFIX = get_env_value("CACHE_KEY_PREFIX")
OTP_TTL = int(get_env_value("OTP_TTL"))
DEFAULT_TEST_OTP = get_env_value("DEFAULT_TEST_OTP")
OTP_LENGTH = int(get_env_value("OTP_LENGTH", default_value=4))

API_RESEND_OTP_ENDPOINT = get_env_value("API_RESEND_OTP_ENDPOINT")
API_LOGIN_ENDPOINT = get_env_value("API_LOGIN_ENDPOINT")

TIME_ZONE_CELERY_BEAT = get_env_value("TIME_ZONE_CELERY_BEAT", default_value=TIME_ZONE)

# Lottery
# ضریبِ «مبلغ جایزه» نسبت به امتیازهای خرج‌شده برای خرید بلیطِ توپ.
LOTTERY_PRIZE_COEFFICIENT = 2

# Python profiler
# توجه: profiler (cProfile روی هر درخواست) در dev باعث کندیِ شدید و خطای
# «Another profiling tool is already active» می‌شود؛ برای سرعتِ توسعه خاموش است.
SILKY_PYTHON_PROFILER = False
SILKY_PYTHON_PROFILER_BINARY = False
SILKY_PYTHON_PROFILER_RESULT_PATH: Path = BASE_DIR / "logs" / "silk"

# Authentication (requires superuser)
SILKY_AUTHENTICATION = True
SILKY_AUTHORISATION = True

# Meta profiling
SILKY_META = True

# Request interception
# 0 = هیچ درخواستی توسط silk ضبط نمی‌شود (سریع‌ترین برای dev). برای دیباگ با
# داشبورد silk این مقدار را به 100 برگردانید.
SILKY_INTERCEPT_PERCENT = 0

# Request/Response body limits (in bytes)
SILKY_MAX_REQUEST_BODY_SIZE = -1
SILKY_MAX_RESPONSE_BODY_SIZE = -1

# Record retention
SILKY_MAX_RECORDED_REQUESTS = 10000
SILKY_MAX_RECORDED_REQUESTS_CHECK_PERCENT = 10

SILKY_IGNORE_PATHS: list[str] = [
    r"^/static/",
    r"^/media/",
    r"^/silk/",
    r"^/favicon\.ico$",
    r"^/robots\.txt$",
]
