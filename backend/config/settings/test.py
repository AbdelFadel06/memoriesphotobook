from .base import *

SECRET_KEY = "test-key-not-secret-but-long-enough-for-hs256"
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
CELERY_TASK_ALWAYS_EAGER = False
S3_ENDPOINT_URL = "http://storage.test"
S3_PUBLIC_ENDPOINT_URL = "http://storage.test"
S3_ACCESS_KEY_ID = "test"
S3_SECRET_ACCESS_KEY = "test"
S3_BUCKET = "test-bucket"
REST_FRAMEWORK = {
    **REST_FRAMEWORK,
    "DEFAULT_THROTTLE_RATES": {"auth": None, "export": None},
}
