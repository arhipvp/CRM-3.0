"""
Сигналы Django для автоматического логирования изменений ролей и прав.
"""

import json

from django.contrib.auth.models import User
from django.db.models.signals import post_delete, post_save, pre_save
from django.dispatch import receiver

from .models import AuditLog, Permission, Role, RolePermission, UserRole


def serialize_model_fields(instance, exclude_fields=None):
    """Преобразовать поля модели в JSON-совместимый формат"""
    exclude_fields = exclude_fields or []
    result = {}

    for field in instance._meta.fields:
        if field.name in exclude_fields:
            continue

        value = getattr(instance, field.name)

        # Преобразование специальных типов
        if value is None:
            result[field.name] = None
        elif hasattr(value, "isoformat"):  # DateTime, Date
            result[field.name] = value.isoformat()
        elif isinstance(value, (int, str, bool, float)):
            result[field.name] = value
        else:
            # Fallback: преобразовать в строку
            result[field.name] = str(value)

    return result


# ============ ROLE SIGNALS ============


@receiver(post_save, sender=Role)
def log_role_change(sender, instance, created, **kwargs):
    """Логировать создание/обновление роли"""

    # Получить текущего пользователя (если доступно в контексте)
    # Примечание: в сигналах может не быть request.user, поэтому используем None
    actor = getattr(instance, "_audit_actor", None)

    action = "create" if created else "update"

    new_value = {
        "name": instance.name,
        "description": instance.description,
    }

    # Получить старое значение, если это обновление
    old_value = None
    if not created:
        # При обновлении роли, старое значение может быть загружено из БД
        # Но в сигнале у нас есть только новые значения
        # Пользователь должен передать _old_value через instance
        old_value = getattr(instance, "_old_value", None)

    AuditLog.objects.create(
        actor=actor,
        object_type="role",
        object_id=str(instance.id),
        object_name=instance.name,
        action=action,
        description=f"{'Создана' if created else 'Изменена'} роль '{instance.name}'",
        old_value=old_value,
        new_value=new_value,
    )


@receiver(post_delete, sender=Role)
def log_role_delete(sender, instance, **kwargs):
    """Логировать удаление роли"""

    actor = getattr(instance, "_audit_actor", None)

    AuditLog.objects.create(
        actor=actor,
        object_type="role",
        object_id=str(instance.id),
        object_name=instance.name,
        action="delete",
        description=f"Удалена роль '{instance.name}'",
    )


# ============ PERMISSION SIGNALS ============


@receiver(post_save, sender=Permission)
def log_permission_change(sender, instance, created, **kwargs):
    """Логировать создание/обновление права"""

    actor = getattr(instance, "_audit_actor", None)

    action = "create" if created else "update"

    permission_name = (
        f"{instance.get_resource_display()} - {instance.get_action_display()}"
    )

    new_value = {
        "resource": instance.resource,
        "action": instance.action,
        "resource_display": instance.get_resource_display(),
        "action_display": instance.get_action_display(),
    }

    old_value = getattr(instance, "_old_value", None)

    AuditLog.objects.create(
        actor=actor,
        object_type="permission",
        object_id=str(instance.id),
        object_name=permission_name,
        action=action,
        description=f"{'Создано' if created else 'Изменено'} право '{permission_name}'",
        old_value=old_value,
        new_value=new_value,
    )


@receiver(post_delete, sender=Permission)
def log_permission_delete(sender, instance, **kwargs):
    """Логировать удаление права"""

    actor = getattr(instance, "_audit_actor", None)
    object_name = f"{instance.get_resource_display()} - {instance.get_action_display()}"

    AuditLog.objects.create(
        actor=actor,
        object_type="permission",
        object_id=str(instance.id),
        object_name=object_name,
        action="delete",
        description=f"Удалено право '{object_name}'",
    )


# ============ USER ROLE SIGNALS ============


@receiver(post_save, sender=UserRole)
def log_user_role_assign(sender, instance, created, **kwargs):
    """Логировать назначение роли пользователю"""

    if not created:
        return  # Логируем только создание, не обновление

    actor = getattr(instance, "_audit_actor", None)

    new_value = {
        "user_id": instance.user.id,
        "user_username": instance.user.username,
        "role_id": str(instance.role.id),
        "role_name": instance.role.name,
    }

    AuditLog.objects.create(
        actor=actor,
        object_type="user_role",
        object_id=f"{instance.user.id}-{instance.role.id}",
        object_name=f"{instance.user.username} - {instance.role.name}",
        action="assign",
        description=f"Пользователю '{instance.user.username}' назначена роль '{instance.role.name}'",
        new_value=new_value,
    )


@receiver(post_delete, sender=UserRole)
def log_user_role_revoke(sender, instance, **kwargs):
    """Логировать отзыв роли у пользователя"""

    actor = getattr(instance, "_audit_actor", None)

    old_value = {
        "user_id": instance.user.id,
        "user_username": instance.user.username,
        "role_id": str(instance.role.id),
        "role_name": instance.role.name,
    }

    AuditLog.objects.create(
        actor=actor,
        object_type="user_role",
        object_id=f"{instance.user.id}-{instance.role.id}",
        object_name=f"{instance.user.username} - {instance.role.name}",
        action="revoke",
        description=f"У пользователя '{instance.user.username}' отозвана роль '{instance.role.name}'",
        old_value=old_value,
    )


# ============ ROLE PERMISSION SIGNALS ============


@receiver(post_save, sender=RolePermission)
def log_role_permission_assign(sender, instance, created, **kwargs):
    """Логировать добавление права к роли"""

    if not created:
        return

    actor = getattr(instance, "_audit_actor", None)

    permission_display = f"{instance.permission.get_resource_display()} - {instance.permission.get_action_display()}"

    new_value = {
        "role_id": str(instance.role.id),
        "role_name": instance.role.name,
        "permission_id": str(instance.permission.id),
        "permission_name": permission_display,
    }

    AuditLog.objects.create(
        actor=actor,
        object_type="role_permission",
        object_id=f"{instance.role.id}-{instance.permission.id}",
        object_name=f"{instance.role.name} - {permission_display}",
        action="assign",
        description=f"Роли '{instance.role.name}' добавлено право '{permission_display}'",
        new_value=new_value,
    )


@receiver(post_delete, sender=RolePermission)
def log_role_permission_revoke(sender, instance, **kwargs):
    """Логировать удаление права у роли"""

    actor = getattr(instance, "_audit_actor", None)

    permission_display = f"{instance.permission.get_resource_display()} - {instance.permission.get_action_display()}"

    old_value = {
        "role_id": str(instance.role.id),
        "role_name": instance.role.name,
        "permission_id": str(instance.permission.id),
        "permission_name": permission_display,
    }

    AuditLog.objects.create(
        actor=actor,
        object_type="role_permission",
        object_id=f"{instance.role.id}-{instance.permission.id}",
        object_name=f"{instance.role.name} - {permission_display}",
        action="revoke",
        description=f"У роли '{instance.role.name}' удалено право '{permission_display}'",
        old_value=old_value,
    )
