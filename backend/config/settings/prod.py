import os

import sentry_sdk

from .base import *

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 60 * 60 * 24 * 30

if dsn := os.environ.get("SENTRY_DSN"):
    sentry_sdk.init(dsn=dsn, send_default_pii=False, traces_sample_rate=0.0)
