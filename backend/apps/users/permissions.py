from rest_framework import permissions

from .models import Permission, RolePermission, UserRole


class IsAdminUser(permissions.BasePermission):
    """
    Проверяет, является ли пользователь администратором.
    Администратор имеет роль 'Администратор'.
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        # Проверить, есть ли у пользователя роль 'Администратор'
        admin_role = UserRole.objects.filter(
            user=request.user, role__name="Администратор"
        ).exists()

        return admin_role


class HasDealPermission(permissions.BasePermission):
    """
    Проверяет права на сделку:
    - Администратор: полный доступ
    - Менеджер: видит и редактирует только свои сделки
      (где он seller ИЛИ executor)
    - Наблюдатель: только просмотр своих сделок
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        # Администратор имеет полный доступ
        is_admin = UserRole.objects.filter(
            user=request.user, role__name="Администратор"
        ).exists()

        if is_admin:
            return True

        # Другие пользователи с любой ролью могут видеть список
        # (но список будет отфильтрован в queryset)
        user_roles = UserRole.objects.filter(user=request.user).exists()
        return user_roles

    def has_object_permission(self, request, view, obj):
        # Администратор имеет полный доступ
        is_admin = UserRole.objects.filter(
            user=request.user, role__name="Администратор"
        ).exists()

        if is_admin:
            return True

        # Проверить, является ли пользователь продавцом или исполнителем
        is_seller = obj.seller_id == request.user.id
        is_executor = obj.executor_id == request.user.id

        if not (is_seller or is_executor):
            return False

        # Проверить права
        # GET (просмотр) - доступно всем
        if request.method in permissions.SAFE_METHODS:
            return True

        # POST/PATCH/DELETE (редактирование, удаление) - только менеджерам
        # Проверить, есть ли у пользователя роль 'Менеджер'
        is_manager = UserRole.objects.filter(
            user=request.user, role__name="Менеджер"
        ).exists()

        if request.method in ["POST", "PATCH", "PUT", "DELETE"]:
            return is_manager

        return True


class HasRolePermission(permissions.BasePermission):
    """
    Базовый класс для проверки прав на основе системы ролей и прав.
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        # Администратор имеет полный доступ
        is_admin = UserRole.objects.filter(
            user=request.user, role__name="Администратор"
        ).exists()

        if is_admin:
            return True

        return True  # Другие проверки происходят в has_object_permission
