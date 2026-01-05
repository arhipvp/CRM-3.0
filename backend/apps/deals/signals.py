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

from .models import Deal, Quote

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

    if was_deleted and not now_deleted:
        # Это восстановление
        action = "restore"
    elif was_deleted and now_deleted:
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
        "restore": f"Восстановлена сделка '{instance.title}'",
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
    if action == "update":
        changes = get_changed_fields(instance, old_value)
        messages = []
        if "status" in changes:
            messages.append(
                "статус: '{old}' -> '{new}'".format(
                    old=changes["status"]["old"],
                    new=changes["status"]["new"],
                )
            )
        if "stage_name" in changes:
            messages.append(
                "стадия: '{old}' -> '{new}'".format(
                    old=changes["stage_name"]["old"],
                    new=changes["stage_name"]["new"],
                )
            )
        if messages:
            from apps.notifications.telegram_notifications import notify_deal_event

            notify_deal_event(
                instance,
                "Сделка '{title}': {changes}.".format(
                    title=instance.title,
                    changes="; ".join(messages),
                ),
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


@receiver(pre_save, sender=Quote)
def quote_pre_save(sender, instance, **kwargs):
    """Сохраняем старые значения расчета перед сохранением."""
    if instance.pk:
        try:
            old_instance = Quote.objects.with_deleted().get(pk=instance.pk)
            store_old_values(old_instance)
            instance._was_deleted = old_instance.deleted_at is not None
            instance._now_deleted = instance.deleted_at is not None
        except Quote.DoesNotExist:
            pass


@receiver(post_save, sender=Quote)
def log_quote_change(sender, instance, created, **kwargs):
    """Логируем операции с расчетом."""

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

    quote_name = f"{instance.insurance_type.name} — {instance.insurance_company.name}"

    description_map = {
        "create": f"Создан расчет '{quote_name}'",
        "update": f"Обновлен расчет '{quote_name}'",
        "soft_delete": f"Удален расчет '{quote_name}'",
    }

    AuditLog.objects.create(
        actor=actor,
        object_type="quote",
        object_id=str(instance.id),
        object_name=quote_name,
        action=action,
        description=description_map.get(action),
        old_value=old_value,
        new_value=new_value if action != "soft_delete" else None,
    )

    for attr in ("_was_deleted", "_now_deleted", "_old_value"):
        if hasattr(instance, attr):
            delattr(instance, attr)


@receiver(post_delete, sender=Quote)
def log_quote_delete(sender, instance, **kwargs):
    """Логируем окончательное удаление расчета."""

    actor = getattr(instance, "_audit_actor", None)
    quote_name = f"{instance.insurance_type.name} — {instance.insurance_company.name}"

    AuditLog.objects.create(
        actor=actor,
        object_type="quote",
        object_id=str(instance.id),
        object_name=quote_name,
        action="hard_delete",
        description=f"Документально удален расчет '{quote_name}'",
    )
