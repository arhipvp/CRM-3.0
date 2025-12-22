from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from .models import AuditLog, Permission, Role, RolePermission, UserRole


class PermissionSerializer(serializers.ModelSerializer):
    """Сериализатор для прав доступа"""

    resource_display = serializers.CharField(
        source="get_resource_display", read_only=True
    )
    action_display = serializers.CharField(source="get_action_display", read_only=True)

    class Meta:
        model = Permission
        fields = [
            "id",
            "resource",
            "action",
            "resource_display",
            "action_display",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]


class RolePermissionSerializer(serializers.ModelSerializer):
    """Сериализатор для связи роли и прав"""

    permission = PermissionSerializer(read_only=True)
    permission_id = serializers.PrimaryKeyRelatedField(
        queryset=Permission.objects.all(), write_only=True, source="permission"
    )

    class Meta:
        model = RolePermission
        fields = ["id", "permission", "permission_id", "created_at"]
        read_only_fields = ["created_at"]


class RoleSerializer(serializers.ModelSerializer):
    """Сериализатор для ролей"""

    permissions = RolePermissionSerializer(many=True, read_only=True)
    user_count = serializers.SerializerMethodField()

    class Meta:
        model = Role
        fields = [
            "id",
            "name",
            "description",
            "permissions",
            "user_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def get_user_count(self, obj):
        """Количество пользователей с этой ролью"""
        return obj.users.count()


class RoleDetailSerializer(RoleSerializer):
    """Детальный сериализатор для роли с полной информацией"""

    class Meta:
        model = Role
        fields = [
            "id",
            "name",
            "description",
            "permissions",
            "user_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]


class UserRoleSerializer(serializers.ModelSerializer):
    """Сериализатор для связи пользователя и роли"""

    role = RoleSerializer(read_only=True)
    role_id = serializers.PrimaryKeyRelatedField(
        queryset=Role.objects.all(), write_only=True, source="role"
    )

    class Meta:
        model = UserRole
        fields = ["id", "role", "role_id", "created_at"]
        read_only_fields = ["created_at"]


class UserSerializer(serializers.ModelSerializer):
    """Сериализатор для пользователя"""

    user_roles = UserRoleSerializer(many=True, read_only=True)
    roles = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "is_active",
            "is_staff",
            "user_roles",
            "roles",
        ]
        read_only_fields = ["id"]

    def get_roles(self, obj):
        """Список названий ролей пользователя"""
        return obj.user_roles.values_list("role__name", flat=True)


class UserDetailSerializer(UserSerializer):
    """Детальный сериализатор для пользователя с полной информацией"""

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "is_active",
            "is_staff",
            "user_roles",
            "roles",
            "date_joined",
        ]
        read_only_fields = ["id", "date_joined"]


class UserCreateUpdateSerializer(serializers.ModelSerializer):
    """Сериализатор для создания и обновления пользователя"""

    password = serializers.CharField(write_only=True, required=False)
    role_ids = serializers.PrimaryKeyRelatedField(
        queryset=Role.objects.all(), many=True, write_only=True, required=False
    )

    class Meta:
        model = User
        fields = [
            "username",
            "email",
            "first_name",
            "last_name",
            "password",
            "is_active",
            "role_ids",
        ]

    def create(self, validated_data):
        """Создание нового пользователя"""
        password = validated_data.pop("password", None)
        role_ids = validated_data.pop("role_ids", [])

        user = User.objects.create_user(**validated_data)

        if password:
            user.set_password(password)
            user.save()

        # Назначить роли
        for role in role_ids:
            UserRole.objects.get_or_create(user=user, role=role)

        return user

    def update(self, instance, validated_data):
        """Обновление пользователя"""
        password = validated_data.pop("password", None)
        role_ids = validated_data.pop("role_ids", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if password:
            instance.set_password(password)

        instance.save()

        # Обновить роли, если переданы
        if role_ids is not None:
            instance.user_roles.all().delete()
            for role in role_ids:
                UserRole.objects.get_or_create(user=instance, role=role)

        return instance


class LoginSerializer(serializers.Serializer):
    """Сериализатор для входа пользователя"""

    username = serializers.CharField(max_length=150)
    password = serializers.CharField(max_length=128, write_only=True)

    def validate(self, data):
        username = data.get("username")
        password = data.get("password")

        if not username or not password:
            raise serializers.ValidationError("Необходимо указать username и password")

        user = authenticate(username=username, password=password)

        if not user:
            raise serializers.ValidationError("Неверный username или password")

        if not user.is_active:
            raise serializers.ValidationError("Пользователь неактивен")

        data["user"] = user
        return data


class ChangePasswordSerializer(serializers.Serializer):
    """Проверяет текущий пароль и валидирует новый."""

    current_password = serializers.CharField(max_length=128, write_only=True)
    new_password = serializers.CharField(max_length=128, write_only=True)

    def validate(self, data):
        user = self.context.get("user")
        if not user or not user.is_authenticated:
            raise serializers.ValidationError("Требуется авторизация.")

        current_password = data.get("current_password")
        new_password = data.get("new_password")

        if not user.check_password(current_password):
            raise serializers.ValidationError(
                {"current_password": "Текущий пароль неверный."}
            )

        if current_password == new_password:
            raise serializers.ValidationError(
                {"new_password": "Новый пароль должен отличаться от текущего."}
            )

        try:
            validate_password(new_password, user=user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(
                {"new_password": list(exc.messages)}
            ) from exc

        return data


class TokenSerializer(serializers.Serializer):
    """Сериализатор для возврата токенов"""

    refresh = serializers.CharField()
    access = serializers.CharField()
    user = UserDetailSerializer(read_only=True)


class RefreshTokenSerializer(serializers.Serializer):
    """Сериализатор для обновления access токена"""

    refresh = serializers.CharField()
    access = serializers.CharField(read_only=True)


class AuditLogSerializer(serializers.ModelSerializer):
    """Сериализатор для журнала аудита"""

    actor_username = serializers.CharField(
        source="actor.username", read_only=True, allow_null=True
    )
    object_type_display = serializers.CharField(
        source="get_object_type_display", read_only=True
    )
    action_display = serializers.CharField(source="get_action_display", read_only=True)

    class Meta:
        model = AuditLog
        fields = [
            "id",
            "actor",
            "actor_username",
            "object_type",
            "object_type_display",
            "object_id",
            "object_name",
            "action",
            "action_display",
            "description",
            "old_value",
            "new_value",
            "created_at",
        ]
        read_only_fields = ["id", "actor", "created_at", "old_value", "new_value"]
