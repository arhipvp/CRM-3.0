import logging
from rest_framework import permissions, status
from rest_framework.response import Response
from apps.users.models import UserRole

logger = logging.getLogger(__name__)


class EditProtectedMixin:
    """
    Миксин для ограничения редактирования только Admin пользователям.
    Добавить в ViewSet: class MyViewSet(EditProtectedMixin, viewsets.ModelViewSet)
    """
    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        model_name = instance.__class__.__name__
        instance_id = str(instance.id)
        user_id = request.user.id if request.user else None
        username = request.user.username if request.user else 'Anonymous'

        if not request.user.user_roles.filter(role__name='Admin').exists():
            logger.warning(
                f"Unauthorized update attempt | Model: {model_name} | ID: {instance_id} | "
                f"User: {username} (ID: {user_id}) | Fields: {list(request.data.keys())}"
            )
            return Response(
                {'detail': 'Только администратор может редактировать данные'},
                status=status.HTTP_403_FORBIDDEN
            )

        logger.info(
            f"Record updated (full) | Model: {model_name} | ID: {instance_id} | "
            f"Admin: {username} (ID: {user_id}) | Fields: {list(request.data.keys())}"
        )
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        model_name = instance.__class__.__name__
        instance_id = str(instance.id)
        user_id = request.user.id if request.user else None
        username = request.user.username if request.user else 'Anonymous'

        if not request.user.user_roles.filter(role__name='Admin').exists():
            logger.warning(
                f"Unauthorized partial update attempt | Model: {model_name} | ID: {instance_id} | "
                f"User: {username} (ID: {user_id}) | Fields: {list(request.data.keys())}"
            )
            return Response(
                {'detail': 'Только администратор может редактировать данные'},
                status=status.HTTP_403_FORBIDDEN
            )

        logger.info(
            f"Record updated (partial) | Model: {model_name} | ID: {instance_id} | "
            f"Admin: {username} (ID: {user_id}) | Fields: {list(request.data.keys())}"
        )
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        model_name = instance.__class__.__name__
        instance_id = str(instance.id)
        user_id = request.user.id if request.user else None
        username = request.user.username if request.user else 'Anonymous'

        if not request.user.user_roles.filter(role__name='Admin').exists():
            logger.warning(
                f"Unauthorized delete attempt | Model: {model_name} | ID: {instance_id} | "
                f"User: {username} (ID: {user_id})"
            )
            return Response(
                {'detail': 'Только администратор может удалять данные'},
                status=status.HTTP_403_FORBIDDEN
            )

        logger.info(
            f"Record deleted | Model: {model_name} | ID: {instance_id} | "
            f"Admin: {username} (ID: {user_id})"
        )
        return super().destroy(request, *args, **kwargs)


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
