from django.contrib.auth.models import User
from rest_framework import permissions, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet
from rest_framework_simplejwt.tokens import RefreshToken

from .models import AuditLog, Permission, Role, RolePermission, UserRole
from .response_helpers import error_response, message_response
from .serializers import (
    AuditLogSerializer,
    ChangePasswordSerializer,
    LoginSerializer,
    PermissionSerializer,
    RefreshTokenSerializer,
    RoleDetailSerializer,
    RoleSerializer,
    UserCreateUpdateSerializer,
    UserDetailSerializer,
    UserSerializer,
)


class PermissionViewSet(ModelViewSet):
    """ViewSet для управления правами доступа (требуется авторизация)"""

    queryset = Permission.objects.all()
    serializer_class = PermissionSerializer
    permission_classes = [permissions.IsAuthenticated, permissions.IsAdminUser]


class RoleViewSet(ModelViewSet):
    """ViewSet для управления ролями (требуется авторизация)"""

    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [permissions.IsAuthenticated, permissions.IsAdminUser]

    def get_serializer_class(self):
        if self.action == "retrieve":
            return RoleDetailSerializer
        return RoleSerializer

    @action(detail=True, methods=["post"])
    def add_permission(self, request, pk=None):
        """Добавить право к роли"""
        role = self.get_object()
        permission_id = request.data.get("permission_id")

        if not permission_id:
            return error_response(
                "permission_id is required", status.HTTP_400_BAD_REQUEST
            )

        try:
            permission = Permission.objects.get(id=permission_id)
        except Permission.DoesNotExist:
            return error_response("Permission not found", status.HTTP_404_NOT_FOUND)

        role_perm, created = RolePermission.objects.get_or_create(
            role=role, permission=permission
        )

        if created:
            return message_response(
                f"Permission {permission} added to role {role.name}",
                status.HTTP_201_CREATED,
            )
        else:
            return message_response(
                f"Permission {permission} already exists in role {role.name}",
                status.HTTP_200_OK,
            )

    @action(detail=True, methods=["post"])
    def remove_permission(self, request, pk=None):
        """Удалить право из роли"""
        role = self.get_object()
        permission_id = request.data.get("permission_id")

        if not permission_id:
            return error_response(
                "permission_id is required", status.HTTP_400_BAD_REQUEST
            )

        try:
            role_perm = RolePermission.objects.get(
                role=role, permission_id=permission_id
            )
            role_perm.delete()
            return message_response(
                "Permission removed from role", status.HTTP_204_NO_CONTENT
            )
        except RolePermission.DoesNotExist:
            return error_response(
                "Permission not found in this role", status.HTTP_404_NOT_FOUND
            )

    @action(detail=False, methods=["post"])
    def assign_user(self, request):
        """Назначить роль пользователю"""
        user_id = request.data.get("user_id")
        role_id = request.data.get("role_id")

        if not user_id or not role_id:
            return error_response(
                "user_id and role_id are required", status.HTTP_400_BAD_REQUEST
            )

        try:
            user = User.objects.get(id=user_id)
            role = Role.objects.get(id=role_id)
        except (User.DoesNotExist, Role.DoesNotExist):
            return error_response("User or Role not found", status.HTTP_404_NOT_FOUND)

        user_role, created = UserRole.objects.get_or_create(user=user, role=role)

        if created:
            return message_response(
                f"Role {role.name} assigned to user {user.username}",
                status.HTTP_201_CREATED,
            )
        else:
            return message_response(
                f"User already has role {role.name}", status.HTTP_200_OK
            )


class UserViewSet(ModelViewSet):
    """ViewSet для управления пользователями (требуется авторизация)"""

    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_serializer_class(self):
        if (
            self.action == "create"
            or self.action == "update"
            or self.action == "partial_update"
        ):
            return UserCreateUpdateSerializer
        elif self.action == "retrieve":
            return UserDetailSerializer
        return UserSerializer

    @action(detail=True, methods=["post"])
    def add_role(self, request, pk=None):
        """Добавить роль пользователю"""
        user = self.get_object()
        role_id = request.data.get("role_id")

        if not role_id:
            return error_response("role_id is required", status.HTTP_400_BAD_REQUEST)

        try:
            role = Role.objects.get(id=role_id)
        except Role.DoesNotExist:
            return error_response("Role not found", status.HTTP_404_NOT_FOUND)

        user_role, created = UserRole.objects.get_or_create(user=user, role=role)

        if created:
            return message_response(
                f"Role {role.name} added to user {user.username}",
                status.HTTP_201_CREATED,
            )
        else:
            return message_response(
                f"User already has role {role.name}", status.HTTP_200_OK
            )

    @action(detail=True, methods=["post"])
    def remove_role(self, request, pk=None):
        """Удалить роль у пользователя"""
        user = self.get_object()
        role_id = request.data.get("role_id")

        if not role_id:
            return error_response("role_id is required", status.HTTP_400_BAD_REQUEST)

        try:
            user_role = UserRole.objects.get(user=user, role_id=role_id)
            user_role.delete()
            return message_response(
                "Role removed from user", status.HTTP_204_NO_CONTENT
            )
        except UserRole.DoesNotExist:
            return error_response(
                "User does not have this role", status.HTTP_404_NOT_FOUND
            )

    @action(detail=True, methods=["get"])
    def permissions(self, request, pk=None):
        """Получить все права пользователя через его роли"""
        user = self.get_object()

        # Получить все роли пользователя
        roles = user.user_roles.values_list("role", flat=True)

        # Получить все права из этих ролей
        permissions = (
            RolePermission.objects.filter(role_id__in=roles)
            .select_related("permission")
            .distinct("permission")
        )

        serializer = PermissionSerializer(
            [rp.permission for rp in permissions], many=True
        )

        return Response({"user": user.username, "permissions": serializer.data})


class AuditLogViewSet(ModelViewSet):
    """ViewSet для просмотра журнала аудита (только чтение, требуется авторизация)"""

    queryset = AuditLog.objects.all()
    serializer_class = AuditLogSerializer
    permission_classes = [AllowAny]
    pagination_class = None

    def get_queryset(self):
        """Админы видят все логи, остальные видят логи только своих действий"""
        queryset = super().get_queryset()
        user = self.request.user

        # Проверить, есть ли у пользователя роль администратора
        is_admin = user.user_roles.filter(role__name="Admin").exists()

        if not is_admin:
            # Обычные пользователи видят только логи своих действий
            queryset = queryset.filter(actor=user)

        return queryset

    def create(self, request, *args, **kwargs):
        """Запретить создание логов через API"""
        return Response(
            {"detail": "Логи создаются автоматически и не могут быть созданы вручную"},
            status=status.HTTP_403_FORBIDDEN,
        )

    def update(self, request, *args, **kwargs):
        """Запретить обновление логов"""
        return Response(
            {"detail": "Логи не могут быть изменены"}, status=status.HTTP_403_FORBIDDEN
        )

    def destroy(self, request, *args, **kwargs):
        """Запретить удаление логов"""
        return Response(
            {"detail": "Логи не могут быть удалены"}, status=status.HTTP_403_FORBIDDEN
        )

    @action(detail=False, methods=["get"])
    def by_object(self, request):
        """Получить логи для конкретного объекта"""
        object_type = request.query_params.get("object_type")
        object_id = request.query_params.get("object_id")

        if not object_type or not object_id:
            return error_response(
                "object_type и object_id обязательны", status.HTTP_400_BAD_REQUEST
            )

        queryset = self.get_queryset().filter(
            object_type=object_type, object_id=object_id
        )

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def by_actor(self, request):
        """Получить логи конкретного пользователя"""
        actor_id = request.query_params.get("actor_id")

        if not actor_id:
            return error_response("actor_id обязателен", status.HTTP_400_BAD_REQUEST)

        try:
            actor_id_value = int(actor_id)
        except (TypeError, ValueError):
            return error_response(
                "actor_id должен быть числом", status.HTTP_400_BAD_REQUEST
            )

        # Админы видят логи любого пользователя, остальные только свои
        is_admin = request.user.user_roles.filter(role__name="Admin").exists()
        if not is_admin and actor_id_value != request.user.id:
            return Response(
                {"detail": "Доступ запрещён"}, status=status.HTTP_403_FORBIDDEN
            )

        queryset = AuditLog.objects.filter(actor_id=actor_id_value)
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)


@api_view(["POST"])
@permission_classes([AllowAny])
def login_view(request):
    """
    Эндпоинт для входа пользователя (без авторизации).
    Принимает: username, password
    Возвращает: refresh, access токены и информацию о пользователе
    """
    serializer = LoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    user = serializer.validated_data["user"]

    # Генерируем токены
    refresh = RefreshToken.for_user(user)

    response_data = {
        "refresh": str(refresh),
        "access": str(refresh.access_token),
        "user": UserDetailSerializer(user).data,
    }

    return Response(response_data, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([AllowAny])
def refresh_token_view(request):
    """
    Эндпоинт для обновления access токена (без авторизации).
    Принимает: refresh токен
    Возвращает: новый access токен
    """
    serializer = RefreshTokenSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    try:
        refresh = RefreshToken(request.data["refresh"])
        access = str(refresh.access_token)
        return Response({"access": access})
    except Exception:
        return error_response("Invalid refresh token", status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def change_password_view(request):
    serializer = ChangePasswordSerializer(
        data=request.data, context={"user": request.user}
    )
    serializer.is_valid(raise_exception=True)

    request.user.set_password(serializer.validated_data["new_password"])
    request.user.save(update_fields=["password"])

    return Response({"detail": "Пароль обновлен."}, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def current_user_view(request):
    """
    Эндпоинт для получения информации о текущем пользователе.
    Для аутентифицированного пользователя возвращает его данные.
    Для анонимного пользователя возвращает информацию об анонимном пользователе.
    """

    if request.user.is_authenticated:
        serializer = UserDetailSerializer(request.user)
        data = serializer.data
        data["is_authenticated"] = True
        return Response(data)
    else:
        # Возвращаем информацию об анонимном пользователе
        return Response(
            {
                "id": None,
                "username": "anonymous",
                "email": "",
                "is_authenticated": False,
            }
        )
