import os

from . import settings as base_settings

os.environ.setdefault("DJANGO_SECRET_KEY", "test-secret-key")
os.environ.setdefault("DEBUG", "True")
os.environ.setdefault("ALLOWED_HOSTS", "localhost,127.0.0.1,testserver")
os.environ.setdefault(
    "CORS_ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
)
os.environ.setdefault(
    "CSRF_TRUSTED_ORIGINS", "http://localhost:8000,http://127.0.0.1:8000"
)

from .settings import *  # noqa: F401,F403


def _test_flag(var_name: str, default: str = "false") -> bool:
    return os.getenv(var_name, default).strip().lower() in {"1", "true", "yes", "on"}


if not _test_flag("CRM_TEST_USE_POSTGRES"):
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": str(base_settings.BASE_DIR / "test.sqlite3"),
            "ATOMIC_REQUESTS": False,
        }
    }
    MIGRATION_MODULES = {
        app_config.split(".")[-1]: None
        for app_config in base_settings.INSTALLED_APPS
        if app_config.startswith("apps.")
    }

PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
