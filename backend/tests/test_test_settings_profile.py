import os

from django.conf import settings


def test_sqlite_is_default_test_database_profile():
    if os.getenv("CRM_TEST_USE_POSTGRES", "").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }:
        assert settings.DATABASES["default"]["ENGINE"] != "django.db.backends.sqlite3"
        return

    assert settings.DATABASES["default"]["ENGINE"] == "django.db.backends.sqlite3"
