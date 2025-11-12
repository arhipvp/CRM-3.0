from rest_framework import permissions
from apps.users.models import UserRole


class IsAdmin(permissions.BasePermission):
    """
    Доступ только для пользователей с ролью Admin (Администратор).
    """
    message = "У вас нет прав администратора."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        return UserRole.objects.filter(
            user=request.user,
            role__name='Admin'
        ).exists()


class IsAuthenticated(permissions.BasePermission):
    """
    Доступ только для аутентифицированных пользователей.
    """
    message = "Требуется аутентификация."

    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated


class IsSellerOrExecutorOrAdmin(permissions.BasePermission):
    """
    Доступ для:
    - Администраторов (все данные)
    - Пользователей, которые являются seller или executor в сделке

    Используется для get_queryset() фильтрации - здесь проверяем объект.
    """
    message = "У вас нет доступа к этому ресурсу."

    def has_object_permission(self, request, view, obj):
        # Администраторы видят всё
        is_admin = UserRole.objects.filter(
            user=request.user,
            role__name='Admin'
        ).exists()
        if is_admin:
            return True

        # Проверяем связанную сделку (если объект имеет deal)
        deal = getattr(obj, 'deal', None)
        if deal:
            return (deal.seller_id == request.user.id or
                    deal.executor_id == request.user.id)

        return False


class IsAdmin_ReadOnly(permissions.BasePermission):
    """
    Полный доступ для администраторов, остальные только чтение.
    """
    message = "У вас нет прав администратора."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        # Для чтения доступно аутентифицированным
        if request.method in permissions.SAFE_METHODS:
            return True

        # Для записи нужна роль Admin
        return UserRole.objects.filter(
            user=request.user,
            role__name='Admin'
        ).exists()
