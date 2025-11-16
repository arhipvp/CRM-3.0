"""Django signals для логирования изменений Client."""

import logging

from apps.common.audit_helpers import (
    get_changed_fields,
    serialize_model_fields,
    store_old_values,
)
from apps.common.drive import DriveError, ensure_client_folder
from apps.users.models import AuditLog
from django.db.models.signals import post_delete, post_save, pre_save
from django.dispatch import receiver

from .models import Client

logger = logging.getLogger(__name__)


@receiver(pre_save, sender=Client)
def client_pre_save(sender, instance, **kwargs):
    """Сохранить старые значения перед сохранением."""
    if instance.pk:
        try:
            old_instance = Client.objects.with_deleted().get(pk=instance.pk)
            store_old_values(old_instance)
            instance._was_deleted = old_instance.deleted_at is not None
            instance._now_deleted = instance.deleted_at is not None
        except Client.DoesNotExist:
            pass


@receiver(post_save, sender=Client)
def log_client_change(sender, instance, created, **kwargs):
    """Логировать создание/обновление Client"""

    actor = getattr(instance, "_audit_actor", None)

    was_deleted = getattr(instance, "_was_deleted", False)
    now_deleted = getattr(instance, "_now_deleted", False)

    if was_deleted and now_deleted:
        action = "update"
    elif not was_deleted and now_deleted:
        action = "soft_delete"
    elif created:
        action = "create"
    else:
        action = "update"

    new_value = serialize_model_fields(instance, exclude_fields=["deleted_at"])

    old_value = getattr(instance, "_old_value", None)

    description_map = {
        "create": f"Создан клиент '{instance.name}'",
        "update": f"Изменён клиент '{instance.name}'",
        "soft_delete": f"Удалён клиент '{instance.name}'",
    }

    AuditLog.objects.create(
        actor=actor,
        object_type="client",
        object_id=str(instance.id),
        object_name=instance.name,
        action=action,
        description=description_map.get(action),
        old_value=old_value,
        new_value=new_value if action != "soft_delete" else None,
    )

    if hasattr(instance, "_was_deleted"):
        delattr(instance, "_was_deleted")
    if hasattr(instance, "_now_deleted"):
        delattr(instance, "_now_deleted")
    if hasattr(instance, "_old_value"):
        delattr(instance, "_old_value")

    try:
        ensure_client_folder(instance)
    except DriveError:
        logger.exception("Failed to sync Google Drive folder for client %s", instance.pk)


@receiver(post_delete, sender=Client)
def log_client_delete(sender, instance, **kwargs):
    """Логировать жёсткое удаление Client."""

    actor = getattr(instance, "_audit_actor", None)

    AuditLog.objects.create(
        actor=actor,
        object_type="client",
        object_id=str(instance.id),
        object_name=instance.name,
        action="hard_delete",
        description=f"Окончательно удалён клиент '{instance.name}'",
    )
