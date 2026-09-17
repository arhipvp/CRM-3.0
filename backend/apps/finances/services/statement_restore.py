"""Atomic statement deletion and conservative restoration of its former records."""

from apps.users.models import AuditLog
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from ..models import FinancialRecord, Statement
from ..permissions import get_deal_from_payment, is_admin_user, user_has_deal_access


def _record_details(record):
    payment = record.payment
    deal = get_deal_from_payment(payment)
    return {
        "id": str(record.pk),
        "client": getattr(getattr(deal, "client", None), "name", ""),
        "deal": getattr(deal, "title", ""),
        "policy": getattr(payment.policy, "number", ""),
        "description": record.description,
        "amount": str(record.amount),
    }


def _related_records(queryset):
    return queryset.select_related(
        "payment__policy__deal__client",
        "payment__deal__client",
        "payment__policy__client",
        "payment__policy__insured_client",
    ).order_by("pk")


@transaction.atomic
def delete_statement(instance):
    statement = Statement.objects.with_deleted().select_for_update().get(pk=instance.pk)
    if statement.deleted_at:
        return
    if statement.paid_at:
        raise ValidationError("Нельзя удалять выплаченную ведомость.")
    records = list(
        _related_records(
            FinancialRecord.objects.select_for_update(of=("self",)).filter(
                statement=statement
            )
        )
    )
    statement.deletion_snapshot = {
        "version": 1,
        "records": [_record_details(record) for record in records],
    }
    FinancialRecord.objects.with_deleted().filter(statement=statement).update(
        statement=None
    )
    statement.deleted_at = timezone.now()
    statement.save(update_fields=["deleted_at", "deletion_snapshot", "updated_at"])
    instance.deleted_at = statement.deleted_at
    instance.deletion_snapshot = statement.deletion_snapshot


REASONS = {
    "missing": "Запись больше не существует.",
    "forbidden": "Нет доступа к записи.",
    "deleted": "Запись удалена.",
    "related_deleted": "Связанный платёж, полис, сделка или клиент удалён.",
    "already_assigned": "Запись уже включена в другую ведомость.",
    "posted": "Запись уже проведена.",
    "wrong_type": "Тип записи не соответствует типу ведомости.",
}


def _skip_reason(record, statement, user):
    if record is None:
        return "missing"
    payment = record.payment
    deal = get_deal_from_payment(payment)
    if not user_has_deal_access(user, deal, allow_executor=False):
        return "forbidden"
    if record.deleted_at:
        return "deleted"
    policy = payment.policy
    related = [payment, policy, deal, payment.deal, getattr(deal, "client", None)]
    if policy:
        related.extend([policy.client, policy.insured_client])
    if any(getattr(obj, "deleted_at", None) for obj in related if obj is not None):
        return "related_deleted"
    if record.statement_id:
        return "already_assigned"
    if record.date:
        return "posted"
    if record.record_type != statement.statement_type:
        return "wrong_type"
    return None


@transaction.atomic
def restore_statement(statement_id, *, user, name=None):
    # Import locally: the serializer also uses services from this package.
    from ..serializers import StatementSerializer

    statement = get_object_or_404(
        Statement.objects.with_deleted().select_for_update(), pk=statement_id
    )
    if not is_admin_user(user) and statement.created_by_id != user.pk:
        raise PermissionDenied(
            "Восстановить ведомость может только автор или администратор."
        )
    if not statement.deleted_at:
        raise ValidationError("Ведомость уже восстановлена.")
    validator = StatementSerializer(instance=statement)
    attrs = {"name": name if name is not None else statement.name}
    validator._validate_unique_name(attrs)
    snapshot = statement.deletion_snapshot
    snapshot_missing = not isinstance(snapshot, dict) or snapshot.get("version") != 1
    entries = [] if snapshot_missing else snapshot.get("records", [])
    ids = [entry["id"] for entry in entries]
    records = {
        str(record.pk): record
        for record in _related_records(
            FinancialRecord.objects.with_deleted()
            .select_for_update(of=("self",))
            .filter(pk__in=ids)
        )
    }
    restored_ids = []
    skipped = []
    for entry in entries:
        record = records.get(entry["id"])
        reason = _skip_reason(record, statement, user)
        if reason:
            details = (
                {"id": entry["id"]}
                if reason in {"missing", "forbidden"}
                else entry.copy()
            )
            skipped.append({**details, "reason": reason, "message": REASONS[reason]})
        else:
            restored_ids.append(entry["id"])
    old_value = {"deleted_at": statement.deleted_at.isoformat(), "name": statement.name}
    statement.name = attrs["name"]
    statement.deleted_at = None
    validator._save_statement_with_unique_name_handling(
        lambda: statement.save(update_fields=["name", "deleted_at", "updated_at"])
    )
    FinancialRecord.objects.filter(pk__in=restored_ids).update(statement=statement)
    AuditLog.objects.create(
        actor=user,
        object_type="statement",
        object_id=str(statement.pk),
        object_name=statement.name,
        action="restore",
        description="Ведомость восстановлена",
        old_value=old_value,
        new_value={
            "name": statement.name,
            "restored_record_ids": restored_ids,
            "skipped_count": len(skipped),
            "snapshot_missing": snapshot_missing,
        },
    )
    return statement, {
        "restored_count": len(restored_ids),
        "restored_record_ids": restored_ids,
        "skipped_records": skipped,
        "snapshot_missing": snapshot_missing,
    }
