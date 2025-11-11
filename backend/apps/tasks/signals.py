"""Django signals для логирования изменений Task."""

from django.db.models.signals import post_save, post_delete, pre_save
from django.dispatch import receiver
from apps.users.models import AuditLog
from apps.common.audit_helpers import serialize_model_fields, get_changed_fields, store_old_values
from .models import Task


@receiver(pre_save, sender=Task)
def task_pre_save(sender, instance, **kwargs):
    """Сохранить старые значения перед сохранением."""
    if instance.pk:
        try:
            old_instance = Task.objects.with_deleted().get(pk=instance.pk)
            store_old_values(old_instance)
            instance._was_deleted = old_instance.deleted_at is not None
            instance._now_deleted = instance.deleted_at is not None
        except Task.DoesNotExist:
            pass


@receiver(post_save, sender=Task)
def log_task_change(sender, instance, created, **kwargs):
    """Логировать создание/обновление Task"""

    actor = getattr(instance, '_audit_actor', None)

    was_deleted = getattr(instance, '_was_deleted', False)
    now_deleted = getattr(instance, '_now_deleted', False)

    if was_deleted and now_deleted:
        action = 'update'
    elif not was_deleted and now_deleted:
        action = 'soft_delete'
    elif created:
        action = 'create'
    else:
        action = 'update'

    new_value = serialize_model_fields(instance, exclude_fields=['deleted_at'])

    old_value = getattr(instance, '_old_value', None)

    description_map = {
        'create': f"Создана задача '{instance.title}'",
        'update': f"Изменена задача '{instance.title}'",
        'soft_delete': f"Удалена задача '{instance.title}'",
    }

    AuditLog.objects.create(
        actor=actor,
        object_type='task',
        object_id=str(instance.id),
        object_name=instance.title,
        action=action,
        description=description_map.get(action),
        old_value=old_value,
        new_value=new_value if action != 'soft_delete' else None,
    )

    if hasattr(instance, '_was_deleted'):
        delattr(instance, '_was_deleted')
    if hasattr(instance, '_now_deleted'):
        delattr(instance, '_now_deleted')
    if hasattr(instance, '_old_value'):
        delattr(instance, '_old_value')


@receiver(post_delete, sender=Task)
def log_task_delete(sender, instance, **kwargs):
    """Логировать жёсткое удаление Task."""

    actor = getattr(instance, '_audit_actor', None)

    AuditLog.objects.create(
        actor=actor,
        object_type='task',
        object_id=str(instance.id),
        object_name=instance.title,
        action='hard_delete',
        description=f"Окончательно удалена задача '{instance.title}'",
    )
