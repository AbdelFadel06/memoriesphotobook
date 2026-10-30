import os
from datetime import timedelta
from pathlib import Path

import dj_database_url
import django_stubs_ext
from celery.schedules import crontab

# Makes Django generics such as BaseUserManager[User] subscriptable at runtime.
django_stubs_ext.monkeypatch()

BASE_DIR = Path(__file__).resolve().parent.parent.parent


def env_list(name: str, default: str = "") -> list[str]:
    return [item.strip() for item in os.environ.get(name, default).split(",") if item.strip()]


SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "")
DEBUG = False
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "drf_spectacular",
    "corsheaders",
    "apps.accounts",
    "apps.layouts",
    "apps.photos",
    "apps.albums",
    "apps.exports",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "render" / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

DATABASES = {"default": dj_database_url.config(conn_max_age=60)}
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "fr"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# --- API ---
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "EXCEPTION_HANDLER": "config.exceptions.api_exception_handler",
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.CursorPagination",
    "PAGE_SIZE": 50,
    "DEFAULT_THROTTLE_RATES": {
        "auth": "20/min",
        "export": "20/day",
    },
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=14),
    "ROTATE_REFRESH_TOKENS": True,
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Photobook API",
    "VERSION": "0.1.0",
    "SERVE_INCLUDE_SCHEMA": False,
}

CORS_ALLOWED_ORIGINS = env_list("CORS_ALLOWED_ORIGINS")

# --- Celery ---
CELERY_BROKER_URL = os.environ.get("REDIS_URL", "redis://redis:6379/0")
CELERY_RESULT_BACKEND = None
CELERY_TASK_DEFAULT_QUEUE = "maintenance"
CELERY_TASK_ROUTES = {
    "apps.photos.tasks.*": {"queue": "images"},
    "apps.exports.tasks.*": {"queue": "pdf"},
}
CELERY_TASK_ACKS_LATE = True
CELERY_BEAT_SCHEDULE = {
    "purge-deleted-albums": {
        "task": "apps.albums.tasks.purge_deleted_albums",
        "schedule": crontab(hour=3, minute=30),
        "options": {"queue": "maintenance"},
    },
    "cleanup-exports": {
        "task": "apps.exports.tasks.cleanup_exports",
        "schedule": crontab(hour=3, minute=0),
        "options": {"queue": "maintenance"},
    },
}
CELERY_WORKER_PREFETCH_MULTIPLIER = 1

# --- Storage (S3-compatible, private bucket) ---
S3_ENDPOINT_URL = os.environ.get("S3_ENDPOINT_URL")
S3_PUBLIC_ENDPOINT_URL = os.environ.get("S3_PUBLIC_ENDPOINT_URL") or S3_ENDPOINT_URL
S3_ACCESS_KEY_ID = os.environ.get("S3_ACCESS_KEY_ID")
S3_SECRET_ACCESS_KEY = os.environ.get("S3_SECRET_ACCESS_KEY")
S3_BUCKET = os.environ.get("S3_BUCKET", "photobook")
S3_REGION = os.environ.get("S3_REGION", "us-east-1")
SIGNED_URL_TTL_SECONDS = 15 * 60

# --- PDF export ---
# The PDF worker renders pages with the frontend's /print route (single renderer).
FRONTEND_INTERNAL_URL = os.environ.get("FRONTEND_INTERNAL_URL", "http://frontend:3000")
PRINT_DPI = 300
PDF_RENDER_TIMEOUT_SECONDS = 5 * 60
EXPORT_RETENTION_DAYS = 30

# --- Shared layouts (single source of truth for formats, themes, templates) ---
SHARED_LAYOUTS_DIR = Path(
    os.environ.get("SHARED_LAYOUTS_DIR", BASE_DIR.parent / "shared" / "layouts")
)

# --- Quotas (defaults, configurable) ---
PHOTO_MAX_BYTES = 30 * 1024 * 1024
AVATAR_MAX_BYTES = 5 * 1024 * 1024
PHOTO_ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"]
PHOTOS_PER_ALBUM = 300
ALBUM_VERSIONS_KEPT = 50
DELETED_ALBUMS_RETENTION_DAYS = 30
STORAGE_PER_USER_BYTES = 5 * 1024**3
DEFAULT_PHOTO_QUOTA = 3000
EXPORTS_CONCURRENT_PER_USER = 3
EXPORTS_PER_DAY = 20
