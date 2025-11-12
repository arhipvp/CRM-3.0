"""Django signals для логирования изменений Document."""

from apps.common.audit_helpers import (
    get_changed_fields,
    serialize_model_fields,
    store_old_values,
)
from apps.users.models import AuditLog
from django.db.models.signals import post_delete, post_save, pre_save
from django.dispatch import receiver

from .models import Document


@receiver(pre_save, sender=Document)
def document_pre_save(sender, instance, **kwargs):
    """Сохранить старые значения перед сохранением."""
    if instance.pk:
        try:
            old_instance = Document.objects.with_deleted().get(pk=instance.pk)
            store_old_values(old_instance)
            instance._was_deleted = old_instance.deleted_at is not None
            instance._now_deleted = instance.deleted_at is not None
        except Document.DoesNotExist:
            pass


@receiver(post_save, sender=Document)
def log_document_change(sender, instance, created, **kwargs):
    """Логировать создание/обновление Document"""

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

    doc_name = instance.file.name if instance.file else f"Документ #{instance.id}"

    description_map = {
        "create": f"Загружен документ '{doc_name}'",
        "update": f"Изменён документ '{doc_name}'",
        "soft_delete": f"Удалён документ '{doc_name}'",
    }

    AuditLog.objects.create(
        actor=actor,
        object_type="document",
        object_id=str(instance.id),
        object_name=doc_name,
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


@receiver(post_delete, sender=Document)
def log_document_delete(sender, instance, **kwargs):
    """Логировать жёсткое удаление Document."""

    actor = getattr(instance, "_audit_actor", None)
    doc_name = instance.file.name if instance.file else f"Документ #{instance.id}"

    AuditLog.objects.create(
        actor=actor,
        object_type="document",
        object_id=str(instance.id),
        object_name=doc_name,
        action="hard_delete",
        description=f"Окончательно удалён документ '{doc_name}'",
    )
