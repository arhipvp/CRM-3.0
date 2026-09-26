from django.apps import AppConfig


class InsuranceRequestsConfig(AppConfig):
    name = "apps.insurance_requests"

    def ready(self):
        from . import signals  # noqa: F401
