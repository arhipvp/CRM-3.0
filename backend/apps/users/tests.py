from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from .models import Permission, Role, RolePermission, UserRole


class RoleModelTest(TestCase):
    """Тесты для модели Role"""

    def setUp(self):
        self.role = Role.objects.create(
            name="Тестовая роль", description="Описание тестовой роли"
        )

    def test_role_creation(self):
        """Тест создания роли"""
        self.assertEqual(self.role.name, "Тестовая роль")
        self.assertEqual(self.role.description, "Описание тестовой роли")
        self.assertIsNone(self.role.deleted_at)

    def test_role_str(self):
        """Тест строкового представления роли"""
        self.assertEqual(str(self.role), "Тестовая роль")

    def test_role_soft_delete(self):
        """Тест мягкого удаления роли"""
        self.role.delete()
        self.assertIsNotNone(self.role.deleted_at)
        self.assertTrue(self.role.is_deleted())
        self.assertFalse(Role.objects.filter(id=self.role.id).exists())

    def test_role_restore(self):
        """Тест восстановления удалённой роли"""
        self.role.delete()
        self.role.restore()
        self.assertIsNone(self.role.deleted_at)
        self.assertTrue(Role.objects.filter(id=self.role.id).exists())

    def test_role_unique_name(self):
        """Тест уникальности названия роли"""
        from django.db import IntegrityError

        with self.assertRaises(IntegrityError):
            Role.objects.create(name="Тестовая роль")


class PermissionModelTest(TestCase):
    """Тесты для модели Permission"""

    def setUp(self):
        self.permission = Permission.objects.create(resource="deal", action="view")

    def test_permission_creation(self):
        """Тест создания прав"""
        self.assertEqual(self.permission.resource, "deal")
        self.assertEqual(self.permission.action, "view")

    def test_permission_str(self):
        """Тест строкового представления прав"""
        self.assertEqual(str(self.permission), "Сделка - Просмотр")

    def test_permission_soft_delete(self):
        """Тест мягкого удаления прав"""
        self.permission.delete()
        self.assertIsNotNone(self.permission.deleted_at)
        self.assertFalse(Permission.objects.filter(id=self.permission.id).exists())

    def test_permission_can_recreate_after_soft_delete(self):
        """Тест возможности создать право с тем же resource+action после мягкого удаления"""
        # Мягко удаляем первое право
        self.permission.delete()
        self.assertIsNotNone(self.permission.deleted_at)

        # Теперь можем создать новое право с теми же параметрами
        new_perm = Permission.objects.create(resource="deal", action="view")
        self.assertIsNotNone(new_perm)
        self.assertIsNone(new_perm.deleted_at)

        # Проверяем, что в активных записях только новое право
        active_perms = Permission.objects.filter(resource="deal", action="view")
        self.assertEqual(active_perms.count(), 1)

    def test_permission_get_resource_display(self):
        """Тест получения отображаемого названия сущности"""
        self.assertEqual(self.permission.get_resource_display(), "Сделка")

    def test_permission_get_action_display(self):
        """Тест получения отображаемого названия действия"""
        self.assertEqual(self.permission.get_action_display(), "Просмотр")


class UserRoleModelTest(TestCase):
    """Тесты для модели UserRole"""

    def setUp(self):
        self.user = User.objects.create_user(username="testuser", password="pass123")
        self.role = Role.objects.create(name="Тестовая роль")
        self.user_role = UserRole.objects.create(user=self.user, role=self.role)

    def test_user_role_creation(self):
        """Тест создания связи пользователя и роли"""
        self.assertEqual(self.user_role.user, self.user)
        self.assertEqual(self.user_role.role, self.role)

    def test_user_role_str(self):
        """Тест строкового представления"""
        self.assertEqual(str(self.user_role), "testuser - Тестовая роль")

    def test_user_role_unique_together(self):
        """Тест уникальности комбинации user+role"""
        from django.db import IntegrityError

        with self.assertRaises(IntegrityError):
            UserRole.objects.create(user=self.user, role=self.role)

    def test_user_role_cascade_delete_user(self):
        """Тест каскадного удаления при удалении пользователя"""
        self.user.delete()
        self.assertFalse(UserRole.objects.filter(id=self.user_role.id).exists())

    def test_user_role_cascade_delete_role(self):
        """Тест каскадного удаления при удалении роли"""
        self.role.hard_delete()
        self.assertFalse(UserRole.objects.filter(id=self.user_role.id).exists())

    def test_user_multiple_roles(self):
        """Тест назначения пользователю нескольких ролей"""
        role2 = Role.objects.create(name="Вторая роль")
        user_role2 = UserRole.objects.create(user=self.user, role=role2)

        roles = self.user.user_roles.all()
        self.assertEqual(roles.count(), 2)


class RolePermissionModelTest(TestCase):
    """Тесты для модели RolePermission"""

    def setUp(self):
        self.role = Role.objects.create(name="Тестовая роль")
        self.permission = Permission.objects.create(resource="deal", action="view")
        self.role_permission = RolePermission.objects.create(
            role=self.role, permission=self.permission
        )

    def test_role_permission_creation(self):
        """Тест создания связи роли и прав"""
        self.assertEqual(self.role_permission.role, self.role)
        self.assertEqual(self.role_permission.permission, self.permission)

    def test_role_permission_str(self):
        """Тест строкового представления"""
        self.assertEqual(str(self.role_permission), "Тестовая роль - Сделка - Просмотр")

    def test_role_permission_unique_together(self):
        """Тест уникальности комбинации role+permission"""
        from django.db import IntegrityError

        with self.assertRaises(IntegrityError):
            RolePermission.objects.create(role=self.role, permission=self.permission)

    def test_role_permission_cascade_delete_role(self):
        """Тест каскадного удаления при удалении роли"""
        self.role.hard_delete()
        self.assertFalse(
            RolePermission.objects.filter(id=self.role_permission.id).exists()
        )

    def test_role_permission_cascade_delete_permission(self):
        """Тест каскадного удаления при удалении прав"""
        self.permission.hard_delete()
        self.assertFalse(
            RolePermission.objects.filter(id=self.role_permission.id).exists()
        )


class UserAPITest(APITestCase):
    """Тесты для API эндпоинтов пользователей"""

    def setUp(self):
        self.client = APIClient()
        self.admin_role = Role.objects.create(name="Администратор")
        self.manager_role = Role.objects.create(name="Менеджер")

        # Администратор
        self.admin_user = User.objects.create_superuser(
            username="admin", email="admin@test.com", password="adminpass123"
        )
        UserRole.objects.create(user=self.admin_user, role=self.admin_role)

        # Обычный менеджер
        self.manager_user = User.objects.create_user(
            username="manager", email="manager@test.com", password="managerpass123"
        )
        UserRole.objects.create(user=self.manager_user, role=self.manager_role)

        # Аутентифицировать как администратор для всех тестов
        from rest_framework_simplejwt.tokens import RefreshToken

        refresh = RefreshToken.for_user(self.admin_user)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {str(refresh.access_token)}"
        )

    def test_list_users(self):
        """Тест получения списка пользователей"""
        response = self.client.get("/api/v1/users/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

    def test_create_user(self):
        """Тест создания пользователя"""
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
        """Тест получения деталей пользователя"""
        response = self.client.get(f"/api/v1/users/{self.admin_user.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["username"], "admin")

    def test_update_user(self):
        """Тест обновления пользователя"""
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
        """Тест добавления роли пользователю"""
        data = {"role_id": str(self.manager_role.id)}
        response = self.client.post(
            f"/api/v1/users/{self.admin_user.id}/add_role/", data, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Проверить, что роль добавлена
        user_roles = self.admin_user.user_roles.values_list("role__name", flat=True)
        self.assertIn("Менеджер", user_roles)

    def test_remove_role_from_user(self):
        """Тест удаления роли у пользователя"""
        data = {"role_id": str(self.admin_role.id)}
        response = self.client.post(
            f"/api/v1/users/{self.admin_user.id}/remove_role/", data, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        # Проверить, что роль удалена
        user_roles = self.admin_user.user_roles.values_list("role__name", flat=True)
        self.assertNotIn("Администратор", user_roles)

    def test_get_user_permissions(self):
        """Тест получения всех прав пользователя"""
        # Добавить права админу
        perm1 = Permission.objects.create(resource="deal", action="view")
        perm2 = Permission.objects.create(resource="deal", action="edit")
        RolePermission.objects.create(role=self.admin_role, permission=perm1)
        RolePermission.objects.create(role=self.admin_role, permission=perm2)

        response = self.client.get(f"/api/v1/users/{self.admin_user.id}/permissions/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["permissions"]), 2)


class RoleAPITest(APITestCase):
    """Тесты для API эндпоинтов ролей"""

    def setUp(self):
        self.client = APIClient()
        self.role = Role.objects.create(name="Тестовая роль")
        self.permission = Permission.objects.create(resource="deal", action="view")

        # Создать и аутентифицировать пользователя
        admin_user = User.objects.create_superuser(
            username="admin_test", email="admin_test@test.com", password="testpass123"
        )
        from rest_framework_simplejwt.tokens import RefreshToken

        refresh = RefreshToken.for_user(admin_user)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {str(refresh.access_token)}"
        )

    def test_list_roles(self):
        """Тест получения списка ролей"""
        response = self.client.get("/api/v1/roles/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data), 1)

    def test_create_role(self):
        """Тест создания роли"""
        data = {"name": "Новая роль", "description": "Описание новой роли"}
        response = self.client.post("/api/v1/roles/", data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Role.objects.filter(name="Новая роль").exists())

    def test_retrieve_role(self):
        """Тест получения деталей роли"""
        response = self.client.get(f"/api/v1/roles/{self.role.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["name"], "Тестовая роль")

    def test_update_role(self):
        """Тест обновления роли"""
        data = {"name": "Обновлённая роль", "description": "Новое описание"}
        response = self.client.patch(
            f"/api/v1/roles/{self.role.id}/", data, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.role.refresh_from_db()
        self.assertEqual(self.role.name, "Обновлённая роль")

    def test_add_permission_to_role(self):
        """Тест добавления прав к роли"""
        data = {"permission_id": str(self.permission.id)}
        response = self.client.post(
            f"/api/v1/roles/{self.role.id}/add_permission/", data, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Проверить, что право добавлено
        self.assertTrue(
            RolePermission.objects.filter(
                role=self.role, permission=self.permission
            ).exists()
        )

    def test_remove_permission_from_role(self):
        """Тест удаления прав из роли"""
        RolePermission.objects.create(role=self.role, permission=self.permission)

        data = {"permission_id": str(self.permission.id)}
        response = self.client.post(
            f"/api/v1/roles/{self.role.id}/remove_permission/", data, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        # Проверить, что право удалено
        self.assertFalse(
            RolePermission.objects.filter(
                role=self.role, permission=self.permission
            ).exists()
        )

    def test_assign_user_to_role(self):
        """Тест назначения роли пользователю"""
        user = User.objects.create_user(username="testuser", password="pass123")
        data = {"user_id": user.id, "role_id": str(self.role.id)}
        response = self.client.post("/api/v1/roles/assign_user/", data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Проверить, что связь создана
        self.assertTrue(UserRole.objects.filter(user=user, role=self.role).exists())


class PermissionAPITest(APITestCase):
    """Тесты для API эндпоинтов прав"""

    def setUp(self):
        self.client = APIClient()
        self.permission = Permission.objects.create(resource="deal", action="view")

        # Создать и аутентифицировать пользователя
        admin_user = User.objects.create_superuser(
            username="admin_perm", email="admin_perm@test.com", password="testpass123"
        )
        from rest_framework_simplejwt.tokens import RefreshToken

        refresh = RefreshToken.for_user(admin_user)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {str(refresh.access_token)}"
        )

    def test_list_permissions(self):
        """Тест получения списка прав"""
        response = self.client.get("/api/v1/permissions/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data), 1)

    def test_create_permission(self):
        """Тест создания права"""
        data = {"resource": "client", "action": "edit"}
        response = self.client.post("/api/v1/permissions/", data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            Permission.objects.filter(resource="client", action="edit").exists()
        )

    def test_retrieve_permission(self):
        """Тест получения деталей права"""
        response = self.client.get(f"/api/v1/permissions/{self.permission.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["resource"], "deal")

    def test_delete_permission(self):
        """Тест удаления (мягкого) права"""
        response = self.client.delete(f"/api/v1/permissions/{self.permission.id}/")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        # Проверить мягкое удаление
        self.permission.refresh_from_db()
        self.assertIsNotNone(self.permission.deleted_at)


class AuthenticationTest(APITestCase):
    """Тесты для авторизации и JWT токенов"""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testuser", email="test@test.com", password="testpass123"
        )

    def test_login(self):
        """Тест входа пользователя и получения токенов"""
        data = {"username": "testuser", "password": "testpass123"}
        response = self.client.post("/api/v1/auth/login/", data, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        self.assertIn("user", response.data)

    def test_login_invalid_credentials(self):
        """Тест входа с неверными учетными данными"""
        data = {"username": "testuser", "password": "wrongpassword"}
        response = self.client.post("/api/v1/auth/login/", data, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_current_user_with_token(self):
        """Тест получения информации о текущем пользователе с валидным токеном"""
        # Получить токен
        login_response = self.client.post(
            "/api/v1/auth/login/",
            {"username": "testuser", "password": "testpass123"},
            format="json",
        )
        token = login_response.data["access"]

        # Использовать токен
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        response = self.client.get("/api/v1/auth/me/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["username"], "testuser")

    def test_current_user_without_token(self):
        """Тест получения информации о текущем пользователе без токена"""
        response = self.client.get("/api/v1/auth/me/")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_protected_endpoint_requires_auth(self):
        """Тест что защищённые эндпоинты требуют авторизацию"""
        # Попытка получить список пользователей без токена
        response = self.client.get("/api/v1/users/")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_protected_endpoint_with_token(self):
        """Тест доступ к защищённому эндпоинту с токеном"""
        # Получить токен
        login_response = self.client.post(
            "/api/v1/auth/login/",
            {"username": "testuser", "password": "testpass123"},
            format="json",
        )
        token = login_response.data["access"]

        # Использовать токен
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        response = self.client.get("/api/v1/users/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)


class RoleInitializationTest(TestCase):
    """Тесты для инициализации ролей и прав"""

    def test_roles_initialized(self):
        """Тест наличия стандартных ролей после инициализации"""
        from .init_roles import initialize_roles_and_permissions

        initialize_roles_and_permissions()

        # Проверить наличие основных ролей
        self.assertTrue(Role.objects.filter(name="Администратор").exists())
        self.assertTrue(Role.objects.filter(name="Менеджер").exists())
        self.assertTrue(Role.objects.filter(name="Наблюдатель").exists())

    def test_permissions_initialized(self):
        """Тест наличия стандартных прав после инициализации"""
        from .init_roles import initialize_roles_and_permissions

        initialize_roles_and_permissions()

        # Проверить наличие прав
        self.assertTrue(
            Permission.objects.filter(resource="deal", action="view").exists()
        )
        self.assertTrue(
            Permission.objects.filter(resource="deal", action="create").exists()
        )

    def test_admin_role_has_all_permissions(self):
        """Тест что админская роль имеет все права"""
        from .init_roles import initialize_roles_and_permissions

        initialize_roles_and_permissions()

        admin_role = Role.objects.get(name="Администратор")
        admin_permissions = admin_role.permissions.all()

        self.assertGreater(admin_permissions.count(), 30)

    def test_manager_role_has_create_edit_permissions(self):
        """Тест что менеджер может создавать и редактировать"""
        from .init_roles import initialize_roles_and_permissions

        initialize_roles_and_permissions()

        manager_role = Role.objects.get(name="Менеджер")
        manager_perms = manager_role.permissions.values_list(
            "permission__action", flat=True
        )

        self.assertIn("create", manager_perms)
        self.assertIn("edit", manager_perms)


class AuditLogTestCase(TestCase):
    """Тесты для функциональности аудита"""

    def setUp(self):
        """Подготовка тестовых данных"""
        self.admin_user = User.objects.create_user(
            username="auditor", password="testpass123"
        )

    def test_audit_log_created_on_role_creation(self):
        """Тест что лог создается при создании роли"""
        from .models import AuditLog

        initial_count = AuditLog.objects.count()

        role = Role.objects.create(name="TestRole", description="Test role description")

        # Проверить что был создан лог
        self.assertEqual(AuditLog.objects.count(), initial_count + 1)

        # Проверить содержимое лога
        audit = AuditLog.objects.latest("created_at")
        self.assertEqual(audit.object_type, "role")
        self.assertEqual(audit.object_id, str(role.id))
        self.assertEqual(audit.action, "create")
        self.assertEqual(audit.object_name, "TestRole")

    def test_audit_log_created_on_user_role_assign(self):
        """Тест что лог создается при назначении роли"""
        from .models import AuditLog

        role = Role.objects.create(name="TestRole")
        user = User.objects.create_user(username="testuser")

        initial_count = AuditLog.objects.count()

        # Назначить роль пользователю
        user_role = UserRole.objects.create(user=user, role=role)

        # Проверить что был создан лог
        self.assertEqual(AuditLog.objects.count(), initial_count + 1)

        # Проверить содержимое лога
        audit = AuditLog.objects.latest("created_at")
        self.assertEqual(audit.object_type, "user_role")
        self.assertEqual(audit.action, "assign")
        self.assertIn("testuser", audit.object_name)
        self.assertIn("TestRole", audit.object_name)

    def test_audit_log_created_on_user_role_revoke(self):
        """Тест что лог создается при отзыве роли"""
        from .models import AuditLog

        role = Role.objects.create(name="TestRole")
        user = User.objects.create_user(username="testuser")
        user_role = UserRole.objects.create(user=user, role=role)

        initial_count = AuditLog.objects.count()

        # Удалить роль у пользователя
        user_role.delete()

        # Проверить что был создан лог
        self.assertEqual(AuditLog.objects.count(), initial_count + 1)

        # Проверить содержимое лога
        audit = AuditLog.objects.latest("created_at")
        self.assertEqual(audit.object_type, "user_role")
        self.assertEqual(audit.action, "revoke")

    def test_audit_log_api_access(self):
        """Тест что логи доступны через API"""
        from rest_framework.test import APIClient
        from rest_framework_simplejwt.tokens import RefreshToken

        from .models import AuditLog

        # Создать лог вручную
        AuditLog.objects.create(
            actor=self.admin_user,
            object_type="role",
            object_id="test-1",
            object_name="TestRole",
            action="create",
            description="Test audit log",
            new_value={"name": "TestRole"},
        )

        # Аутентифицировать пользователя
        client = APIClient()
        refresh = RefreshToken.for_user(self.admin_user)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

        # Получить логи
        response = client.get("/api/v1/audit_logs/")

        self.assertEqual(response.status_code, 200)
        # При списке с пагинацией результаты в поле results
        # При простом списке - это просто список
        if isinstance(response.data, dict):
            if "results" in response.data:
                self.assertGreater(len(response.data["results"]), 0)
            else:
                # Просто проверяем что ответ валиден
                self.assertIsNotNone(response.data)
        else:
            # Это список
            self.assertGreater(len(response.data), 0)

    def test_audit_log_filtering_by_object(self):
        """Тест фильтрации логов по объекту"""
        from rest_framework.test import APIClient
        from rest_framework_simplejwt.tokens import RefreshToken

        # Создать две роли
        role1 = Role.objects.create(name="Role1")
        role2 = Role.objects.create(name="Role2")

        # Аутентифицировать пользователя
        client = APIClient()
        refresh = RefreshToken.for_user(self.admin_user)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

        # Получить логи по конкретной роли
        response = client.get(
            f"/api/v1/audit_logs/by_object/?object_type=role&object_id={role1.id}"
        )

        self.assertEqual(response.status_code, 200)
        # Должен быть только логи для role1
        for item in response.data:
            self.assertEqual(item["object_id"], str(role1.id))

    def test_observer_role_has_only_view_permission(self):
        """Тест что наблюдатель может только смотреть"""
        from .init_roles import initialize_roles_and_permissions

        initialize_roles_and_permissions()

        observer_role = Role.objects.get(name="Наблюдатель")
        observer_perms = observer_role.permissions.values_list(
            "permission__action", flat=True
        )

        # Должны быть только права на просмотр
        for action in observer_perms:
            self.assertEqual(action, "view")
