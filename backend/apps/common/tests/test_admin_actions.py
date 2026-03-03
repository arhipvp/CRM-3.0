import pytest
from apps.users.models import Role
from django.contrib.admin.sites import site
from django.contrib.auth.models import User
from django.test import RequestFactory
from uuid import uuid4

pytestmark = [pytest.mark.admin, pytest.mark.django_db]


def _admin_request():
    suffix = uuid4().hex[:8]
    request = RequestFactory().get("/admin/users/role/")
    request.user = User.objects.create_superuser(
        username=f"actions_admin_{suffix}",
        email=f"actions_admin_{suffix}@example.com",
        password="password123",
    )
    return request


def test_restore_action_available_only_when_deleted_exists():
    role_admin = site._registry[Role]
    request = _admin_request()

    active_role = Role.objects.create(name="Active Role")
    actions_without_deleted = role_admin.get_actions(request)
    assert "restore_selected" not in actions_without_deleted

    active_role.delete()
    actions_with_deleted = role_admin.get_actions(request)
    assert "restore_selected" in actions_with_deleted


def test_restore_action_restores_soft_deleted_objects():
    role_admin = site._registry[Role]
    request = _admin_request()

    role = Role.objects.create(name="Role To Restore")
    role.delete()
    assert Role.objects.dead().filter(pk=role.pk).exists()

    queryset = Role.objects.with_deleted().filter(pk=role.pk)
    role_admin.restore_selected(request, queryset)

    assert Role.objects.filter(pk=role.pk).exists()
