from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from .models import Permission, Role, RolePermission, UserRole


class RoleModelTest(TestCase):
    """РўРµСЃС‚С‹ РґР»СЏ РјРѕРґРµР»Рё Role"""

    def setUp(self):
        self.role = Role.objects.create(
            name="РўРµСЃС‚РѕРІР°СЏ СЂРѕР»СЊ",
            description="РћРїРёСЃР°РЅРёРµ С‚РµСЃС‚РѕРІРѕР№ СЂРѕР»Рё",
        )

    def test_role_creation(self):
        """РўРµСЃС‚ СЃРѕР·РґР°РЅРёСЏ СЂРѕР»Рё"""
        self.assertEqual(self.role.name, "РўРµСЃС‚РѕРІР°СЏ СЂРѕР»СЊ")
        self.assertEqual(
            self.role.description, "РћРїРёСЃР°РЅРёРµ С‚РµСЃС‚РѕРІРѕР№ СЂРѕР»Рё"
        )
        self.assertIsNone(self.role.deleted_at)

    def test_role_str(self):
        """РўРµСЃС‚ СЃС‚СЂРѕРєРѕРІРѕРіРѕ РїСЂРµРґСЃС‚Р°РІР»РµРЅРёСЏ СЂРѕР»Рё"""
        self.assertEqual(str(self.role), "РўРµСЃС‚РѕРІР°СЏ СЂРѕР»СЊ")

    def test_role_soft_delete(self):
        """РўРµСЃС‚ РјСЏРіРєРѕРіРѕ СѓРґР°Р»РµРЅРёСЏ СЂРѕР»Рё"""
        self.role.delete()
        self.assertIsNotNone(self.role.deleted_at)
        self.assertTrue(self.role.is_deleted())
        self.assertFalse(Role.objects.filter(id=self.role.id).exists())

    def test_role_restore(self):
        """РўРµСЃС‚ РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёСЏ СѓРґР°Р»С‘РЅРЅРѕР№ СЂРѕР»Рё"""
        self.role.delete()
        self.role.restore()
        self.assertIsNone(self.role.deleted_at)
        self.assertTrue(Role.objects.filter(id=self.role.id).exists())

    def test_role_unique_name(self):
        """РўРµСЃС‚ СѓРЅРёРєР°Р»СЊРЅРѕСЃС‚Рё РЅР°Р·РІР°РЅРёСЏ СЂРѕР»Рё"""
        from django.db import IntegrityError

        with self.assertRaises(IntegrityError):
            Role.objects.create(name="РўРµСЃС‚РѕРІР°СЏ СЂРѕР»СЊ")


class PermissionModelTest(TestCase):
    """РўРµСЃС‚С‹ РґР»СЏ РјРѕРґРµР»Рё Permission"""

    def setUp(self):
        self.permission = Permission.objects.create(resource="deal", action="view")

    def test_permission_creation(self):
        """РўРµСЃС‚ СЃРѕР·РґР°РЅРёСЏ РїСЂР°РІ"""
        self.assertEqual(self.permission.resource, "deal")
        self.assertEqual(self.permission.action, "view")

    def test_permission_str(self):
        """РўРµСЃС‚ СЃС‚СЂРѕРєРѕРІРѕРіРѕ РїСЂРµРґСЃС‚Р°РІР»РµРЅРёСЏ РїСЂР°РІ"""
        self.assertEqual(str(self.permission), "РЎРґРµР»РєР° - РџСЂРѕСЃРјРѕС‚СЂ")

    def test_permission_soft_delete(self):
        """РўРµСЃС‚ РјСЏРіРєРѕРіРѕ СѓРґР°Р»РµРЅРёСЏ РїСЂР°РІ"""
        self.permission.delete()
        self.assertIsNotNone(self.permission.deleted_at)
        self.assertFalse(Permission.objects.filter(id=self.permission.id).exists())

    def test_permission_can_recreate_after_soft_delete(self):
        """РўРµСЃС‚ РІРѕР·РјРѕР¶РЅРѕСЃС‚Рё СЃРѕР·РґР°С‚СЊ РїСЂР°РІРѕ СЃ С‚РµРј Р¶Рµ resource+action РїРѕСЃР»Рµ РјСЏРіРєРѕРіРѕ СѓРґР°Р»РµРЅРёСЏ"""
        # РњСЏРіРєРѕ СѓРґР°Р»СЏРµРј РїРµСЂРІРѕРµ РїСЂР°РІРѕ
        self.permission.delete()
        self.assertIsNotNone(self.permission.deleted_at)

        # РўРµРїРµСЂСЊ РјРѕР¶РµРј СЃРѕР·РґР°С‚СЊ РЅРѕРІРѕРµ РїСЂР°РІРѕ СЃ С‚РµРјРё Р¶Рµ РїР°СЂР°РјРµС‚СЂР°РјРё
        new_perm = Permission.objects.create(resource="deal", action="view")
        self.assertIsNotNone(new_perm)
        self.assertIsNone(new_perm.deleted_at)

        # РџСЂРѕРІРµСЂСЏРµРј, С‡С‚Рѕ РІ Р°РєС‚РёРІРЅС‹С… Р·Р°РїРёСЃСЏС… С‚РѕР»СЊРєРѕ РЅРѕРІРѕРµ РїСЂР°РІРѕ
        active_perms = Permission.objects.filter(resource="deal", action="view")
        self.assertEqual(active_perms.count(), 1)

    def test_permission_get_resource_display(self):
        """РўРµСЃС‚ РїРѕР»СѓС‡РµРЅРёСЏ РѕС‚РѕР±СЂР°Р¶Р°РµРјРѕРіРѕ РЅР°Р·РІР°РЅРёСЏ СЃСѓС‰РЅРѕСЃС‚Рё"""
        self.assertEqual(self.permission.get_resource_display(), "РЎРґРµР»РєР°")

    def test_permission_get_action_display(self):
        """РўРµСЃС‚ РїРѕР»СѓС‡РµРЅРёСЏ РѕС‚РѕР±СЂР°Р¶Р°РµРјРѕРіРѕ РЅР°Р·РІР°РЅРёСЏ РґРµР№СЃС‚РІРёСЏ"""
        self.assertEqual(self.permission.get_action_display(), "РџСЂРѕСЃРјРѕС‚СЂ")


class UserRoleModelTest(TestCase):
    """РўРµСЃС‚С‹ РґР»СЏ РјРѕРґРµР»Рё UserRole"""

    def setUp(self):
        self.user = User.objects.create_user(username="testuser", password="pass123")
        self.role = Role.objects.create(name="РўРµСЃС‚РѕРІР°СЏ СЂРѕР»СЊ")
        self.user_role = UserRole.objects.create(user=self.user, role=self.role)

    def test_user_role_creation(self):
        """РўРµСЃС‚ СЃРѕР·РґР°РЅРёСЏ СЃРІСЏР·Рё РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ Рё СЂРѕР»Рё"""
        self.assertEqual(self.user_role.user, self.user)
        self.assertEqual(self.user_role.role, self.role)

    def test_user_role_str(self):
        """РўРµСЃС‚ СЃС‚СЂРѕРєРѕРІРѕРіРѕ РїСЂРµРґСЃС‚Р°РІР»РµРЅРёСЏ"""
        self.assertEqual(str(self.user_role), "testuser - РўРµСЃС‚РѕРІР°СЏ СЂРѕР»СЊ")

    def test_user_role_unique_together(self):
        """РўРµСЃС‚ СѓРЅРёРєР°Р»СЊРЅРѕСЃС‚Рё РєРѕРјР±РёРЅР°С†РёРё user+role"""
        from django.db import IntegrityError

        with self.assertRaises(IntegrityError):
            UserRole.objects.create(user=self.user, role=self.role)

    def test_user_role_cascade_delete_user(self):
        """РўРµСЃС‚ РєР°СЃРєР°РґРЅРѕРіРѕ СѓРґР°Р»РµРЅРёСЏ РїСЂРё СѓРґР°Р»РµРЅРёРё РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ"""
        self.user.delete()
        self.assertFalse(UserRole.objects.filter(id=self.user_role.id).exists())

    def test_user_role_cascade_delete_role(self):
        """РўРµСЃС‚ РєР°СЃРєР°РґРЅРѕРіРѕ СѓРґР°Р»РµРЅРёСЏ РїСЂРё СѓРґР°Р»РµРЅРёРё СЂРѕР»Рё"""
        self.role.hard_delete()
        self.assertFalse(UserRole.objects.filter(id=self.user_role.id).exists())

    def test_user_multiple_roles(self):
        """РўРµСЃС‚ РЅР°Р·РЅР°С‡РµРЅРёСЏ РїРѕР»СЊР·РѕРІР°С‚РµР»СЋ РЅРµСЃРєРѕР»СЊРєРёС… СЂРѕР»РµР№"""
        role2 = Role.objects.create(name="Р’С‚РѕСЂР°СЏ СЂРѕР»СЊ")
        _ = UserRole.objects.create(user=self.user, role=role2)

        roles = self.user.user_roles.all()
        self.assertEqual(roles.count(), 2)


class RolePermissionModelTest(TestCase):
    """РўРµСЃС‚С‹ РґР»СЏ РјРѕРґРµР»Рё RolePermission"""

    def setUp(self):
        self.role = Role.objects.create(name="РўРµСЃС‚РѕРІР°СЏ СЂРѕР»СЊ")
        self.permission = Permission.objects.create(resource="deal", action="view")
        self.role_permission = RolePermission.objects.create(
            role=self.role, permission=self.permission
        )

    def test_role_permission_creation(self):
        """РўРµСЃС‚ СЃРѕР·РґР°РЅРёСЏ СЃРІСЏР·Рё СЂРѕР»Рё Рё РїСЂР°РІ"""
        self.assertEqual(self.role_permission.role, self.role)
        self.assertEqual(self.role_permission.permission, self.permission)

    def test_role_permission_str(self):
        """РўРµСЃС‚ СЃС‚СЂРѕРєРѕРІРѕРіРѕ РїСЂРµРґСЃС‚Р°РІР»РµРЅРёСЏ"""
        self.assertEqual(
            str(self.role_permission),
            "РўРµСЃС‚РѕРІР°СЏ СЂРѕР»СЊ - РЎРґРµР»РєР° - РџСЂРѕСЃРјРѕС‚СЂ",
        )

    def test_role_permission_unique_together(self):
        """РўРµСЃС‚ СѓРЅРёРєР°Р»СЊРЅРѕСЃС‚Рё РєРѕРјР±РёРЅР°С†РёРё role+permission"""
        from django.db import IntegrityError

        with self.assertRaises(IntegrityError):
            RolePermission.objects.create(role=self.role, permission=self.permission)

    def test_role_permission_cascade_delete_role(self):
        """РўРµСЃС‚ РєР°СЃРєР°РґРЅРѕРіРѕ СѓРґР°Р»РµРЅРёСЏ РїСЂРё СѓРґР°Р»РµРЅРёРё СЂРѕР»Рё"""
        self.role.hard_delete()
        self.assertFalse(
            RolePermission.objects.filter(id=self.role_permission.id).exists()
        )

    def test_role_permission_cascade_delete_permission(self):
        """РўРµСЃС‚ РєР°СЃРєР°РґРЅРѕРіРѕ СѓРґР°Р»РµРЅРёСЏ РїСЂРё СѓРґР°Р»РµРЅРёРё РїСЂР°РІ"""
        self.permission.hard_delete()
        self.assertFalse(
            RolePermission.objects.filter(id=self.role_permission.id).exists()
        )


class UserAPITest(APITestCase):
    """РўРµСЃС‚С‹ РґР»СЏ API СЌРЅРґРїРѕРёРЅС‚РѕРІ РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№"""

    def setUp(self):
        self.client = APIClient()
        self.admin_role = Role.objects.create(name="РђРґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂ")
        self.manager_role = Role.objects.create(name="РњРµРЅРµРґР¶РµСЂ")

        # РђРґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂ
        self.admin_user = User.objects.create_superuser(
            username="admin", email="admin@test.com", password="adminpass123"
        )
        UserRole.objects.create(user=self.admin_user, role=self.admin_role)

        # РћР±С‹С‡РЅС‹Р№ РјРµРЅРµРґР¶РµСЂ
        self.manager_user = User.objects.create_user(
            username="manager", email="manager@test.com", password="managerpass123"
        )
        UserRole.objects.create(user=self.manager_user, role=self.manager_role)

        # РђСѓС‚РµРЅС‚РёС„РёС†РёСЂРѕРІР°С‚СЊ РєР°Рє Р°РґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂ РґР»СЏ РІСЃРµС… С‚РµСЃС‚РѕРІ
        from rest_framework_simplejwt.tokens import RefreshToken

        refresh = RefreshToken.for_user(self.admin_user)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {str(refresh.access_token)}"
        )

    def test_list_users(self):
        """РўРµСЃС‚ РїРѕР»СѓС‡РµРЅРёСЏ СЃРїРёСЃРєР° РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№"""
        response = self.client.get("/api/v1/users/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

    def test_create_user(self):
        """РўРµСЃС‚ СЃРѕР·РґР°РЅРёСЏ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ"""
        data = {
            "username": "newuser",
            "email": "newuser@test.com",
            "password": "newpass123",
            "first_name": "New",
            "last_name": "User",
            "role_ids": [str(self.manager_role.id)],
        }
        response = self.client.post("/api/v1/users/", data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(User.objects.filter(username="newuser").count(), 1)

    def test_retrieve_user(self):
        """РўРµСЃС‚ РїРѕР»СѓС‡РµРЅРёСЏ РґРµС‚Р°Р»РµР№ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ"""
        response = self.client.get(f"/api/v1/users/{self.admin_user.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["username"], "admin")

    def test_update_user(self):
        """РўРµСЃС‚ РѕР±РЅРѕРІР»РµРЅРёСЏ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ"""
        data = {
            "username": "admin",
            "email": "newemail@test.com",
            "first_name": "Updated",
            "is_active": True,
            "role_ids": [str(self.admin_role.id)],
        }
        response = self.client.patch(
            f"/api/v1/users/{self.admin_user.id}/", data, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.admin_user.refresh_from_db()
        self.assertEqual(self.admin_user.first_name, "Updated")

    def test_add_role_to_user(self):
        """РўРµСЃС‚ РґРѕР±Р°РІР»РµРЅРёСЏ СЂРѕР»Рё РїРѕР»СЊР·РѕРІР°С‚РµР»СЋ"""
        data = {"role_id": str(self.manager_role.id)}
        response = self.client.post(
            f"/api/v1/users/{self.admin_user.id}/add_role/", data, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # РџСЂРѕРІРµСЂРёС‚СЊ, С‡С‚Рѕ СЂРѕР»СЊ РґРѕР±Р°РІР»РµРЅР°
        user_roles = self.admin_user.user_roles.values_list("role__name", flat=True)
        self.assertIn("РњРµРЅРµРґР¶РµСЂ", user_roles)

    def test_remove_role_from_user(self):
        """РўРµСЃС‚ СѓРґР°Р»РµРЅРёСЏ СЂРѕР»Рё Сѓ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ"""
        data = {"role_id": str(self.admin_role.id)}
        response = self.client.post(
            f"/api/v1/users/{self.admin_user.id}/remove_role/", data, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        # РџСЂРѕРІРµСЂРёС‚СЊ, С‡С‚Рѕ СЂРѕР»СЊ СѓРґР°Р»РµРЅР°
        user_roles = self.admin_user.user_roles.values_list("role__name", flat=True)
        self.assertNotIn("РђРґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂ", user_roles)

    def test_get_user_permissions(self):
        """РўРµСЃС‚ РїРѕР»СѓС‡РµРЅРёСЏ РІСЃРµС… РїСЂР°РІ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ"""
        # Р”РѕР±Р°РІРёС‚СЊ РїСЂР°РІР° Р°РґРјРёРЅСѓ
        perm1 = Permission.objects.create(resource="deal", action="view")
        perm2 = Permission.objects.create(resource="deal", action="edit")
        RolePermission.objects.create(role=self.admin_role, permission=perm1)
        RolePermission.objects.create(role=self.admin_role, permission=perm2)

        response = self.client.get(f"/api/v1/users/{self.admin_user.id}/permissions/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["permissions"]), 2)


class RoleAPITest(APITestCase):
    """РўРµСЃС‚С‹ РґР»СЏ API СЌРЅРґРїРѕРёРЅС‚РѕРІ СЂРѕР»РµР№"""

    def setUp(self):
        self.client = APIClient()
        self.role = Role.objects.create(name="РўРµСЃС‚РѕРІР°СЏ СЂРѕР»СЊ")
        self.permission = Permission.objects.create(resource="deal", action="view")

        # РЎРѕР·РґР°С‚СЊ Рё Р°СѓС‚РµРЅС‚РёС„РёС†РёСЂРѕРІР°С‚СЊ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ
        admin_user = User.objects.create_superuser(
            username="admin_test", email="admin_test@test.com", password="testpass123"
        )
        from rest_framework_simplejwt.tokens import RefreshToken

        refresh = RefreshToken.for_user(admin_user)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {str(refresh.access_token)}"
        )

    def test_list_roles(self):
        """РўРµСЃС‚ РїРѕР»СѓС‡РµРЅРёСЏ СЃРїРёСЃРєР° СЂРѕР»РµР№"""
        response = self.client.get("/api/v1/roles/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data), 1)

    def test_create_role(self):
        """РўРµСЃС‚ СЃРѕР·РґР°РЅРёСЏ СЂРѕР»Рё"""
        data = {
            "name": "РќРѕРІР°СЏ СЂРѕР»СЊ",
            "description": "РћРїРёСЃР°РЅРёРµ РЅРѕРІРѕР№ СЂРѕР»Рё",
        }
        response = self.client.post("/api/v1/roles/", data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Role.objects.filter(name="РќРѕРІР°СЏ СЂРѕР»СЊ").exists())

    def test_retrieve_role(self):
        """РўРµСЃС‚ РїРѕР»СѓС‡РµРЅРёСЏ РґРµС‚Р°Р»РµР№ СЂРѕР»Рё"""
        response = self.client.get(f"/api/v1/roles/{self.role.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["name"], "РўРµСЃС‚РѕРІР°СЏ СЂРѕР»СЊ")

    def test_update_role(self):
        """РўРµСЃС‚ РѕР±РЅРѕРІР»РµРЅРёСЏ СЂРѕР»Рё"""
        data = {
            "name": "РћР±РЅРѕРІР»С‘РЅРЅР°СЏ СЂРѕР»СЊ",
            "description": "РќРѕРІРѕРµ РѕРїРёСЃР°РЅРёРµ",
        }
        response = self.client.patch(
            f"/api/v1/roles/{self.role.id}/", data, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.role.refresh_from_db()
        self.assertEqual(self.role.name, "РћР±РЅРѕРІР»С‘РЅРЅР°СЏ СЂРѕР»СЊ")

    def test_add_permission_to_role(self):
        """РўРµСЃС‚ РґРѕР±Р°РІР»РµРЅРёСЏ РїСЂР°РІ Рє СЂРѕР»Рё"""
        data = {"permission_id": str(self.permission.id)}
        response = self.client.post(
            f"/api/v1/roles/{self.role.id}/add_permission/", data, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # РџСЂРѕРІРµСЂРёС‚СЊ, С‡С‚Рѕ РїСЂР°РІРѕ РґРѕР±Р°РІР»РµРЅРѕ
        self.assertTrue(
            RolePermission.objects.filter(
                role=self.role, permission=self.permission
            ).exists()
        )

    def test_remove_permission_from_role(self):
        """РўРµСЃС‚ СѓРґР°Р»РµРЅРёСЏ РїСЂР°РІ РёР· СЂРѕР»Рё"""
        RolePermission.objects.create(role=self.role, permission=self.permission)

        data = {"permission_id": str(self.permission.id)}
        response = self.client.post(
            f"/api/v1/roles/{self.role.id}/remove_permission/", data, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        # РџСЂРѕРІРµСЂРёС‚СЊ, С‡С‚Рѕ РїСЂР°РІРѕ СѓРґР°Р»РµРЅРѕ
        self.assertFalse(
            RolePermission.objects.filter(
                role=self.role, permission=self.permission
            ).exists()
        )

    def test_assign_user_to_role(self):
        """РўРµСЃС‚ РЅР°Р·РЅР°С‡РµРЅРёСЏ СЂРѕР»Рё РїРѕР»СЊР·РѕРІР°С‚РµР»СЋ"""
        user = User.objects.create_user(username="testuser", password="pass123")
        data = {"user_id": user.id, "role_id": str(self.role.id)}
        response = self.client.post("/api/v1/roles/assign_user/", data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # РџСЂРѕРІРµСЂРёС‚СЊ, С‡С‚Рѕ СЃРІСЏР·СЊ СЃРѕР·РґР°РЅР°
        self.assertTrue(UserRole.objects.filter(user=user, role=self.role).exists())


class PermissionAPITest(APITestCase):
    """РўРµСЃС‚С‹ РґР»СЏ API СЌРЅРґРїРѕРёРЅС‚РѕРІ РїСЂР°РІ"""

    def setUp(self):
        self.client = APIClient()
        self.permission = Permission.objects.create(resource="deal", action="view")

        # РЎРѕР·РґР°С‚СЊ Рё Р°СѓС‚РµРЅС‚РёС„РёС†РёСЂРѕРІР°С‚СЊ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ
        admin_user = User.objects.create_superuser(
            username="admin_perm", email="admin_perm@test.com", password="testpass123"
        )
        from rest_framework_simplejwt.tokens import RefreshToken

        refresh = RefreshToken.for_user(admin_user)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {str(refresh.access_token)}"
        )

    def test_list_permissions(self):
        """РўРµСЃС‚ РїРѕР»СѓС‡РµРЅРёСЏ СЃРїРёСЃРєР° РїСЂР°РІ"""
        response = self.client.get("/api/v1/permissions/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data), 1)

    def test_create_permission(self):
        """РўРµСЃС‚ СЃРѕР·РґР°РЅРёСЏ РїСЂР°РІР°"""
        data = {"resource": "client", "action": "edit"}
        response = self.client.post("/api/v1/permissions/", data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            Permission.objects.filter(resource="client", action="edit").exists()
        )

    def test_retrieve_permission(self):
        """РўРµСЃС‚ РїРѕР»СѓС‡РµРЅРёСЏ РґРµС‚Р°Р»РµР№ РїСЂР°РІР°"""
        response = self.client.get(f"/api/v1/permissions/{self.permission.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["resource"], "deal")

    def test_delete_permission(self):
        """РўРµСЃС‚ СѓРґР°Р»РµРЅРёСЏ (РјСЏРіРєРѕРіРѕ) РїСЂР°РІР°"""
        response = self.client.delete(f"/api/v1/permissions/{self.permission.id}/")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        # РџСЂРѕРІРµСЂРёС‚СЊ РјСЏРіРєРѕРµ СѓРґР°Р»РµРЅРёРµ
        self.permission.refresh_from_db()
        self.assertIsNotNone(self.permission.deleted_at)


class AuthenticationTest(APITestCase):
    """РўРµСЃС‚С‹ РґР»СЏ Р°РІС‚РѕСЂРёР·Р°С†РёРё Рё JWT С‚РѕРєРµРЅРѕРІ"""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testuser", email="test@test.com", password="testpass123"
        )

    def test_login(self):
        """РўРµСЃС‚ РІС…РѕРґР° РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ Рё РїРѕР»СѓС‡РµРЅРёСЏ С‚РѕРєРµРЅРѕРІ"""
        data = {"username": "testuser", "password": "testpass123"}
        response = self.client.post("/api/v1/auth/login/", data, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        self.assertIn("user", response.data)

    def test_login_invalid_credentials(self):
        """РўРµСЃС‚ РІС…РѕРґР° СЃ РЅРµРІРµСЂРЅС‹РјРё СѓС‡РµС‚РЅС‹РјРё РґР°РЅРЅС‹РјРё"""
        data = {"username": "testuser", "password": "wrongpassword"}
        response = self.client.post("/api/v1/auth/login/", data, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_current_user_with_token(self):
        """РўРµСЃС‚ РїРѕР»СѓС‡РµРЅРёСЏ РёРЅС„РѕСЂРјР°С†РёРё Рѕ С‚РµРєСѓС‰РµРј РїРѕР»СЊР·РѕРІР°С‚РµР»Рµ СЃ РІР°Р»РёРґРЅС‹Рј С‚РѕРєРµРЅРѕРј"""
        # РџРѕР»СѓС‡РёС‚СЊ С‚РѕРєРµРЅ
        login_response = self.client.post(
            "/api/v1/auth/login/",
            {"username": "testuser", "password": "testpass123"},
            format="json",
        )
        token = login_response.data["access"]

        # РСЃРїРѕР»СЊР·РѕРІР°С‚СЊ С‚РѕРєРµРЅ
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        response = self.client.get("/api/v1/auth/me/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["username"], "testuser")

    def test_current_user_without_token(self):
        """РўРµСЃС‚ РїРѕР»СѓС‡РµРЅРёСЏ РёРЅС„РѕСЂРјР°С†РёРё Рѕ С‚РµРєСѓС‰РµРј РїРѕР»СЊР·РѕРІР°С‚РµР»Рµ Р±РµР· С‚РѕРєРµРЅР°"""
        response = self.client.get("/api/v1/auth/me/")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_protected_endpoint_requires_auth(self):
        """РўРµСЃС‚ С‡С‚Рѕ Р·Р°С‰РёС‰С‘РЅРЅС‹Рµ СЌРЅРґРїРѕРёРЅС‚С‹ С‚СЂРµР±СѓСЋС‚ Р°РІС‚РѕСЂРёР·Р°С†РёСЋ"""
        # РџРѕРїС‹С‚РєР° РїРѕР»СѓС‡РёС‚СЊ СЃРїРёСЃРѕРє РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№ Р±РµР· С‚РѕРєРµРЅР°
        response = self.client.get("/api/v1/users/")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_protected_endpoint_with_token(self):
        """РўРµСЃС‚ РґРѕСЃС‚СѓРї Рє Р·Р°С‰РёС‰С‘РЅРЅРѕРјСѓ СЌРЅРґРїРѕРёРЅС‚Сѓ СЃ С‚РѕРєРµРЅРѕРј"""
        # РџРѕР»СѓС‡РёС‚СЊ С‚РѕРєРµРЅ
        login_response = self.client.post(
            "/api/v1/auth/login/",
            {"username": "testuser", "password": "testpass123"},
            format="json",
        )
        token = login_response.data["access"]

        # РСЃРїРѕР»СЊР·РѕРІР°С‚СЊ С‚РѕРєРµРЅ
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        response = self.client.get("/api/v1/users/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)


class RoleInitializationTest(TestCase):
    """РўРµСЃС‚С‹ РґР»СЏ РёРЅРёС†РёР°Р»РёР·Р°С†РёРё СЂРѕР»РµР№ Рё РїСЂР°РІ"""

    def test_roles_initialized(self):
        """РўРµСЃС‚ РЅР°Р»РёС‡РёСЏ СЃС‚Р°РЅРґР°СЂС‚РЅС‹С… СЂРѕР»РµР№ РїРѕСЃР»Рµ РёРЅРёС†РёР°Р»РёР·Р°С†РёРё"""
        from .init_roles import initialize_roles_and_permissions

        initialize_roles_and_permissions()

        # РџСЂРѕРІРµСЂРёС‚СЊ РЅР°Р»РёС‡РёРµ РѕСЃРЅРѕРІРЅС‹С… СЂРѕР»РµР№
        self.assertTrue(Role.objects.filter(name="РђРґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂ").exists())
        self.assertTrue(Role.objects.filter(name="РњРµРЅРµРґР¶РµСЂ").exists())
        self.assertTrue(Role.objects.filter(name="РќР°Р±Р»СЋРґР°С‚РµР»СЊ").exists())

    def test_permissions_initialized(self):
        """РўРµСЃС‚ РЅР°Р»РёС‡РёСЏ СЃС‚Р°РЅРґР°СЂС‚РЅС‹С… РїСЂР°РІ РїРѕСЃР»Рµ РёРЅРёС†РёР°Р»РёР·Р°С†РёРё"""
        from .init_roles import initialize_roles_and_permissions

        initialize_roles_and_permissions()

        # РџСЂРѕРІРµСЂРёС‚СЊ РЅР°Р»РёС‡РёРµ РїСЂР°РІ
        self.assertTrue(
            Permission.objects.filter(resource="deal", action="view").exists()
        )
        self.assertTrue(
            Permission.objects.filter(resource="deal", action="create").exists()
        )

    def test_admin_role_has_all_permissions(self):
        """РўРµСЃС‚ С‡С‚Рѕ Р°РґРјРёРЅСЃРєР°СЏ СЂРѕР»СЊ РёРјРµРµС‚ РІСЃРµ РїСЂР°РІР°"""
        from .init_roles import initialize_roles_and_permissions

        initialize_roles_and_permissions()

        admin_role = Role.objects.get(name="РђРґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂ")
        admin_permissions = admin_role.permissions.all()

        self.assertGreater(admin_permissions.count(), 30)

    def test_manager_role_has_create_edit_permissions(self):
        """РўРµСЃС‚ С‡С‚Рѕ РјРµРЅРµРґР¶РµСЂ РјРѕР¶РµС‚ СЃРѕР·РґР°РІР°С‚СЊ Рё СЂРµРґР°РєС‚РёСЂРѕРІР°С‚СЊ"""
        from .init_roles import initialize_roles_and_permissions

        initialize_roles_and_permissions()

        manager_role = Role.objects.get(name="РњРµРЅРµРґР¶РµСЂ")
        manager_perms = manager_role.permissions.values_list(
            "permission__action", flat=True
        )

        self.assertIn("create", manager_perms)
        self.assertIn("edit", manager_perms)


class AuditLogTestCase(TestCase):
    """РўРµСЃС‚С‹ РґР»СЏ С„СѓРЅРєС†РёРѕРЅР°Р»СЊРЅРѕСЃС‚Рё Р°СѓРґРёС‚Р°"""

    def setUp(self):
        """РџРѕРґРіРѕС‚РѕРІРєР° С‚РµСЃС‚РѕРІС‹С… РґР°РЅРЅС‹С…"""
        self.admin_user = User.objects.create_user(
            username="auditor", password="testpass123"
        )

    def test_audit_log_created_on_role_creation(self):
        """РўРµСЃС‚ С‡С‚Рѕ Р»РѕРі СЃРѕР·РґР°РµС‚СЃСЏ РїСЂРё СЃРѕР·РґР°РЅРёРё СЂРѕР»Рё"""
        from .models import AuditLog

        initial_count = AuditLog.objects.count()

        role = Role.objects.create(name="TestRole", description="Test role description")

        # РџСЂРѕРІРµСЂРёС‚СЊ С‡С‚Рѕ Р±С‹Р» СЃРѕР·РґР°РЅ Р»РѕРі
        self.assertEqual(AuditLog.objects.count(), initial_count + 1)

        # РџСЂРѕРІРµСЂРёС‚СЊ СЃРѕРґРµСЂР¶РёРјРѕРµ Р»РѕРіР°
        audit = AuditLog.objects.latest("created_at")
        self.assertEqual(audit.object_type, "role")
        self.assertEqual(audit.object_id, str(role.id))
        self.assertEqual(audit.action, "create")
        self.assertEqual(audit.object_name, "TestRole")

    def test_audit_log_created_on_user_role_assign(self):
        """РўРµСЃС‚ С‡С‚Рѕ Р»РѕРі СЃРѕР·РґР°РµС‚СЃСЏ РїСЂРё РЅР°Р·РЅР°С‡РµРЅРёРё СЂРѕР»Рё"""
        from .models import AuditLog

        role = Role.objects.create(name="TestRole")
        user = User.objects.create_user(username="testuser")

        initial_count = AuditLog.objects.count()

        # РќР°Р·РЅР°С‡РёС‚СЊ СЂРѕР»СЊ РїРѕР»СЊР·РѕРІР°С‚РµР»СЋ
        _ = UserRole.objects.create(user=user, role=role)

        # РџСЂРѕРІРµСЂРёС‚СЊ С‡С‚Рѕ Р±С‹Р» СЃРѕР·РґР°РЅ Р»РѕРі
        self.assertEqual(AuditLog.objects.count(), initial_count + 1)

        # РџСЂРѕРІРµСЂРёС‚СЊ СЃРѕРґРµСЂР¶РёРјРѕРµ Р»РѕРіР°
        audit = AuditLog.objects.latest("created_at")
        self.assertEqual(audit.object_type, "user_role")
        self.assertEqual(audit.action, "assign")
        self.assertIn("testuser", audit.object_name)
        self.assertIn("TestRole", audit.object_name)

    def test_audit_log_created_on_user_role_revoke(self):
        """РўРµСЃС‚ С‡С‚Рѕ Р»РѕРі СЃРѕР·РґР°РµС‚СЃСЏ РїСЂРё РѕС‚Р·С‹РІРµ СЂРѕР»Рё"""
        from .models import AuditLog

        role = Role.objects.create(name="TestRole")
        user = User.objects.create_user(username="testuser")
        user_role = UserRole.objects.create(user=user, role=role)

        initial_count = AuditLog.objects.count()

        # РЈРґР°Р»РёС‚СЊ СЂРѕР»СЊ Сѓ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ
        user_role.delete()

        # РџСЂРѕРІРµСЂРёС‚СЊ С‡С‚Рѕ Р±С‹Р» СЃРѕР·РґР°РЅ Р»РѕРі
        self.assertEqual(AuditLog.objects.count(), initial_count + 1)

        # РџСЂРѕРІРµСЂРёС‚СЊ СЃРѕРґРµСЂР¶РёРјРѕРµ Р»РѕРіР°
        audit = AuditLog.objects.latest("created_at")
        self.assertEqual(audit.object_type, "user_role")
        self.assertEqual(audit.action, "revoke")

    def test_audit_log_api_access(self):
        """РўРµСЃС‚ С‡С‚Рѕ Р»РѕРіРё РґРѕСЃС‚СѓРїРЅС‹ С‡РµСЂРµР· API"""
        from rest_framework.test import APIClient
        from rest_framework_simplejwt.tokens import RefreshToken

        from .models import AuditLog

        # РЎРѕР·РґР°С‚СЊ Р»РѕРі РІСЂСѓС‡РЅСѓСЋ
        AuditLog.objects.create(
            actor=self.admin_user,
            object_type="role",
            object_id="test-1",
            object_name="TestRole",
            action="create",
            description="Test audit log",
            new_value={"name": "TestRole"},
        )

        # РђСѓС‚РµРЅС‚РёС„РёС†РёСЂРѕРІР°С‚СЊ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ
        client = APIClient()
        refresh = RefreshToken.for_user(self.admin_user)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

        # РџРѕР»СѓС‡РёС‚СЊ Р»РѕРіРё
        response = client.get("/api/v1/audit_logs/")

        self.assertEqual(response.status_code, 200)
        # РџСЂРё СЃРїРёСЃРєРµ СЃ РїР°РіРёРЅР°С†РёРµР№ СЂРµР·СѓР»СЊС‚Р°С‚С‹ РІ РїРѕР»Рµ results
        # РџСЂРё РїСЂРѕСЃС‚РѕРј СЃРїРёСЃРєРµ - СЌС‚Рѕ РїСЂРѕСЃС‚Рѕ СЃРїРёСЃРѕРє
        if isinstance(response.data, dict):
            if "results" in response.data:
                self.assertGreater(len(response.data["results"]), 0)
            else:
                # РџСЂРѕСЃС‚Рѕ РїСЂРѕРІРµСЂСЏРµРј С‡С‚Рѕ РѕС‚РІРµС‚ РІР°Р»РёРґРµРЅ
                self.assertIsNotNone(response.data)
        else:
            # Р­С‚Рѕ СЃРїРёСЃРѕРє
            self.assertGreater(len(response.data), 0)

    def test_audit_log_filtering_by_object(self):
        """РўРµСЃС‚ С„РёР»СЊС‚СЂР°С†РёРё Р»РѕРіРѕРІ РїРѕ РѕР±СЉРµРєС‚Сѓ"""
        from rest_framework.test import APIClient
        from rest_framework_simplejwt.tokens import RefreshToken

        # РЎРѕР·РґР°С‚СЊ РґРІРµ СЂРѕР»Рё
        role1 = Role.objects.create(name="Role1")
        Role.objects.create(name="Role2")

        # РђСѓС‚РµРЅС‚РёС„РёС†РёСЂРѕРІР°С‚СЊ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ
        client = APIClient()
        refresh = RefreshToken.for_user(self.admin_user)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

        # РџРѕР»СѓС‡РёС‚СЊ Р»РѕРіРё РїРѕ РєРѕРЅРєСЂРµС‚РЅРѕР№ СЂРѕР»Рё
        response = client.get(
            f"/api/v1/audit_logs/by_object/?object_type=role&object_id={role1.id}"
        )

        self.assertEqual(response.status_code, 200)
        # Р”РѕР»Р¶РµРЅ Р±С‹С‚СЊ С‚РѕР»СЊРєРѕ Р»РѕРіРё РґР»СЏ role1
        for item in response.data:
            self.assertEqual(item["object_id"], str(role1.id))

    def test_observer_role_has_only_view_permission(self):
        """РўРµСЃС‚ С‡С‚Рѕ РЅР°Р±Р»СЋРґР°С‚РµР»СЊ РјРѕР¶РµС‚ С‚РѕР»СЊРєРѕ СЃРјРѕС‚СЂРµС‚СЊ"""
        from .init_roles import initialize_roles_and_permissions

        initialize_roles_and_permissions()

        observer_role = Role.objects.get(name="РќР°Р±Р»СЋРґР°С‚РµР»СЊ")
        observer_perms = observer_role.permissions.values_list(
            "permission__action", flat=True
        )

        # Р”РѕР»Р¶РЅС‹ Р±С‹С‚СЊ С‚РѕР»СЊРєРѕ РїСЂР°РІР° РЅР° РїСЂРѕСЃРјРѕС‚СЂ
        for action in observer_perms:
            self.assertEqual(action, "view")
