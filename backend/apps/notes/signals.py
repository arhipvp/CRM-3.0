"""
Django signals для аудита Note.
"""

from apps.common.audit_helpers import serialize_model_fields, store_old_values
from apps.users.models import AuditLog
from django.db.models.signals import post_delete, post_save, pre_save
from django.dispatch import receiver

from .models import Note


@receiver(pre_save, sender=Note)
def note_pre_save(sender, instance, **kwargs):
    """Сохраняем старые данные для сравнения."""
    if instance.pk:
        try:
            old_instance = Note.objects.with_deleted().get(pk=instance.pk)
            store_old_values(old_instance)
            instance._was_deleted = old_instance.deleted_at is not None
            instance._now_deleted = instance.deleted_at is not None
        except Note.DoesNotExist:
            pass


@receiver(post_save, sender=Note)
def log_note_change(sender, instance, created, **kwargs):
    """Логируем операции с заметками."""

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
        "create": f"Создана заметка для сделки '{instance.deal}'",
        "update": f"Обновлена заметка для сделки '{instance.deal}'",
        "soft_delete": f"Удалена заметка для сделки '{instance.deal}'",
    }

    AuditLog.objects.create(
        actor=actor,
        object_type="note",
        object_id=str(instance.id),
        object_name=f"Заметка #{instance.id}",
        action=action,
        description=description_map.get(action),
        old_value=old_value,
        new_value=new_value if action != "soft_delete" else None,
    )

    for attr in ("_was_deleted", "_now_deleted", "_old_value"):
        if hasattr(instance, attr):
            delattr(instance, attr)


@receiver(post_delete, sender=Note)
def log_note_delete(sender, instance, **kwargs):
    """Лог удаления заметки."""

    actor = getattr(instance, "_audit_actor", None)
    AuditLog.objects.create(
        actor=actor,
        object_type="note",
        object_id=str(instance.id),
        object_name=f"Заметка #{instance.id}",
        action="delete",
        description=f"Полностью удалена заметка для сделки '{instance.deal}'",
    )
