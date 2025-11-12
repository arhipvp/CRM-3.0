"""
Root pytest configuration file.
Configures Django settings for testing.
"""

import os

import django
import pytest
from django.conf import settings

# Ensure Django settings module is set
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

# Setup Django first
django.setup()


# Ensure all required database configuration keys are present
def ensure_db_settings():
    """Ensure all required database configuration keys exist."""
    for db_name in settings.DATABASES:
        db_config = settings.DATABASES[db_name]
        if "ATOMIC_REQUESTS" not in db_config:
            db_config["ATOMIC_REQUESTS"] = False


ensure_db_settings()


@pytest.fixture(scope="session")
def django_db_setup(django_db_setup, django_db_blocker):
    """Custom Django DB setup for testing."""
    with django_db_blocker.unblock():
        ensure_db_settings()
