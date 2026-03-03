from importlib import import_module

import pytest
from apps.notifications.models import TelegramDealRoutingSession, TelegramInboundMessage
from apps.users.models import AuditLog
from django.apps import apps
from django.contrib.admin.sites import site
from django.test import RequestFactory

pytestmark = [pytest.mark.admin]


class _PermissiveUser:
    is_active = True
    is_staff = True
    is_superuser = True

    @property
    def is_authenticated(self) -> bool:
        return True

    def has_perm(self, perm: str, obj=None) -> bool:  # noqa: ARG002
        return True


def _request():
    request = RequestFactory().get("/admin/")
    request.user = _PermissiveUser()
    return request


def _import_all_admin_modules() -> None:
    for app_config in apps.get_app_configs():
        try:
            import_module(f"{app_config.name}.admin")
        except ModuleNotFoundError:
            continue


def test_audit_log_admin_read_only_permissions():
    _import_all_admin_modules()
    model_admin = site._registry[AuditLog]
    request = _request()

    assert model_admin.has_add_permission(request) is False
    assert model_admin.has_change_permission(request) is False
    assert model_admin.has_delete_permission(request) is False


def test_telegram_admins_read_only_permissions():
    _import_all_admin_modules()
    request = _request()

    inbound_admin = site._registry[TelegramInboundMessage]
    session_admin = site._registry[TelegramDealRoutingSession]

    for model_admin in (inbound_admin, session_admin):
        assert model_admin.has_add_permission(request) is False
        assert model_admin.has_change_permission(request) is False
        assert model_admin.has_delete_permission(request) is False
