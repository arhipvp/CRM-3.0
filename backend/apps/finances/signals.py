"""Django signals для логирования изменений Payment и FinancialRecord."""

from apps.common.audit_helpers import (
    get_changed_fields,
    serialize_model_fields,
    store_old_values,
)
from apps.users.models import AuditLog
from django.db.models.signals import post_delete, post_save, pre_save
from django.dispatch import receiver

from .models import FinancialRecord, Payment

# ============ PAYMENT SIGNALS ============


@receiver(pre_save, sender=Payment)
def payment_pre_save(sender, instance, **kwargs):
    """Сохранить старые значения перед сохранением."""
    if instance.pk:
        try:
            old_instance = Payment.objects.with_deleted().get(pk=instance.pk)
            store_old_values(old_instance)
            instance._was_deleted = old_instance.deleted_at is not None
            instance._now_deleted = instance.deleted_at is not None
        except Payment.DoesNotExist:
            pass


@receiver(post_save, sender=Payment)
def log_payment_change(sender, instance, created, **kwargs):
    """Логировать создание/обновление Payment"""

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

    payment_name = f"Платёж {instance.amount} руб."

    description_map = {
        "create": f"Создан {payment_name}",
        "update": f"Изменён {payment_name}",
        "soft_delete": f"Удалён {payment_name}",
    }

    AuditLog.objects.create(
        actor=actor,
        object_type="payment",
        object_id=str(instance.id),
        object_name=payment_name,
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


@receiver(post_delete, sender=Payment)
def log_payment_delete(sender, instance, **kwargs):
    """Логировать жёсткое удаление Payment."""

    actor = getattr(instance, "_audit_actor", None)
    payment_name = f"Платёж {instance.amount} руб."

    AuditLog.objects.create(
        actor=actor,
        object_type="payment",
        object_id=str(instance.id),
        object_name=payment_name,
        action="hard_delete",
        description=f"Окончательно удалён {payment_name}",
    )


# ============ FINANCIAL RECORD SIGNALS ============


@receiver(pre_save, sender=FinancialRecord)
def financial_record_pre_save(sender, instance, **kwargs):
    """Сохранить старые значения перед сохранением."""
    if instance.pk:
        try:
            old_instance = FinancialRecord.objects.with_deleted().get(pk=instance.pk)
            store_old_values(old_instance)
            instance._was_deleted = old_instance.deleted_at is not None
            instance._now_deleted = instance.deleted_at is not None
        except FinancialRecord.DoesNotExist:
            pass


@receiver(post_save, sender=FinancialRecord)
def log_financial_record_change(sender, instance, created, **kwargs):
    """Логировать создание/обновление FinancialRecord"""

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

    record_type = "Доход" if instance.amount >= 0 else "Расход"
    record_name = f"{record_type} {abs(instance.amount)} руб."

    description_map = {
        "create": f"Создана {record_name}",
        "update": f"Изменена {record_name}",
        "soft_delete": f"Удалена {record_name}",
    }

    AuditLog.objects.create(
        actor=actor,
        object_type="financial_record",
        object_id=str(instance.id),
        object_name=record_name,
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


@receiver(post_delete, sender=FinancialRecord)
def log_financial_record_delete(sender, instance, **kwargs):
    """Логировать жёсткое удаление FinancialRecord."""

    actor = getattr(instance, "_audit_actor", None)
    record_type = "Доход" if instance.amount >= 0 else "Расход"
    record_name = f"{record_type} {abs(instance.amount)} руб."

    AuditLog.objects.create(
        actor=actor,
        object_type="financial_record",
        object_id=str(instance.id),
        object_name=record_name,
        action="hard_delete",
        description=f"Окончательно удалена {record_name}",
    )
