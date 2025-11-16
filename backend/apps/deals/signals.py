"""
Django signals для логирования изменений Deal.
"""

import logging

from apps.common.audit_helpers import (
    get_changed_fields,
    serialize_model_fields,
    store_old_values,
)
from apps.common.drive import DriveError, ensure_deal_folder
from apps.users.models import AuditLog
from django.db.models.signals import post_delete, post_save, pre_save
from django.dispatch import receiver

from .models import Deal

logger = logging.getLogger(__name__)


@receiver(pre_save, sender=Deal)
def deal_pre_save(sender, instance, **kwargs):
    """
    Сохранить старые значения перед сохранением для отслеживания soft_delete.
    """
    if instance.pk:  # Только для существующих объектов
        try:
            old_instance = Deal.objects.with_deleted().get(pk=instance.pk)
            store_old_values(old_instance)
            instance._was_deleted = old_instance.deleted_at is not None
            instance._now_deleted = instance.deleted_at is not None
        except Deal.DoesNotExist:
            pass


@receiver(post_save, sender=Deal)
def log_deal_change(sender, instance, created, **kwargs):
    """Логировать создание/обновление Deal"""

    actor = getattr(instance, "_audit_actor", None)

    # Проверить, это ли soft delete
    was_deleted = getattr(instance, "_was_deleted", False)
    now_deleted = getattr(instance, "_now_deleted", False)

    if was_deleted and now_deleted:
        # Это обновление, но не soft delete (оба deleted)
        action = "update"
    elif not was_deleted and now_deleted:
        # Это soft delete
        action = "soft_delete"
    elif created:
        action = "create"
    else:
        action = "update"

    new_value = serialize_model_fields(instance, exclude_fields=["deleted_at"])

    old_value = getattr(instance, "_old_value", None)

    description_map = {
        "create": f"Создана сделка '{instance.title}'",
        "update": f"Изменена сделка '{instance.title}'",
        "soft_delete": f"Удалена сделка '{instance.title}'",
    }

    AuditLog.objects.create(
        actor=actor,
        object_type="deal",
        object_id=str(instance.id),
        object_name=instance.title,
        action=action,
        description=description_map.get(
            action, f"Операция над сделкой '{instance.title}'"
        ),
        old_value=old_value,
        new_value=new_value if action != "soft_delete" else None,
    )

    # Очистить временные атрибуты
    if hasattr(instance, "_was_deleted"):
        delattr(instance, "_was_deleted")
    if hasattr(instance, "_now_deleted"):
        delattr(instance, "_now_deleted")
    if hasattr(instance, "_old_value"):
        delattr(instance, "_old_value")

    try:
        ensure_deal_folder(instance)
    except DriveError:
        logger.exception("Failed to sync Google Drive folder for deal %s", instance.pk)


@receiver(post_delete, sender=Deal)
def log_deal_delete(sender, instance, **kwargs):
    """Логировать жёсткое удаление Deal (если это произойдёт)"""

    actor = getattr(instance, "_audit_actor", None)

    AuditLog.objects.create(
        actor=actor,
        object_type="deal",
        object_id=str(instance.id),
        object_name=instance.title,
        action="hard_delete",
        description=f"Окончательно удалена сделка '{instance.title}'",
    )
