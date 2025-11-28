import json

from django.db.models import Prefetch, Q

from apps.documents.models import Document
from apps.finances.models import FinancialRecord, Payment
from apps.notes.models import Note
from apps.policies.models import Policy
from apps.tasks.models import Task
from apps.users.models import AuditLog

from .models import Deal, Quote


HISTORY_PREFETCHES = [
    Prefetch(
        "tasks",
        queryset=Task.objects.with_deleted().only("id"),
        to_attr="_history_tasks",
    ),
    Prefetch(
        "documents",
        queryset=Document.objects.with_deleted().only("id"),
        to_attr="_history_documents",
    ),
    Prefetch(
        "notes",
        queryset=Note.objects.with_deleted().only("id"),
        to_attr="_history_notes",
    ),
    Prefetch(
        "policies",
        queryset=Policy.objects.with_deleted().only("id"),
        to_attr="_history_policies",
    ),
    Prefetch(
        "quotes",
        queryset=Quote.objects.with_deleted().only("id"),
        to_attr="_history_quotes",
    ),
    Prefetch(
        "payments",
        queryset=Payment.objects.with_deleted()
        .only("id")
        .prefetch_related(
            Prefetch(
                "financial_records",
                queryset=FinancialRecord.objects.with_deleted().only("id"),
                to_attr="_history_financial_records",
            )
        ),
        to_attr="_history_payments",
    ),
]


def _format_value(value):
    if value is None:
        return None
    if isinstance(value, str):
        return value
    return json.dumps(value, ensure_ascii=False)


def collect_related_ids(deal: Deal) -> dict[str, list[str]]:
    def _prefetched_ids(attr: str, fallback):
        items = getattr(deal, attr, None)
        if items is None:
            return [str(pk) for pk in fallback]
        return [str(obj.id) for obj in items]

    def _financial_record_ids():
        payments = getattr(deal, "_history_payments", None)
        if payments is not None:
            ids = []
            for payment in payments:
                records = getattr(payment, "_history_financial_records", None)
                if records is None:
                    records = (
                        FinancialRecord.objects.with_deleted()
                        .filter(payment=payment)
                        .values_list("id", flat=True)
                    )
                ids.extend(str(pk) for pk in records)
            return list(set(ids))
        return [
            str(pk)
            for pk in FinancialRecord.objects.with_deleted()
            .filter(payment__deal=deal)
            .values_list("id", flat=True)
        ]

    return {
        "task": _prefetched_ids(
            "_history_tasks",
            Task.objects.with_deleted().filter(deal=deal).values_list("id", flat=True),
        ),
        "document": _prefetched_ids(
            "_history_documents",
            Document.objects.with_deleted()
            .filter(deal=deal)
            .values_list("id", flat=True),
        ),
        "payment": _prefetched_ids(
            "_history_payments",
            Payment.objects.with_deleted()
            .filter(deal=deal)
            .values_list("id", flat=True),
        ),
        "financial_record": _financial_record_ids(),
        "note": _prefetched_ids(
            "_history_notes",
            Note.objects.with_deleted().filter(deal=deal).values_list("id", flat=True),
        ),
        "policy": _prefetched_ids(
            "_history_policies",
            Policy.objects.with_deleted()
            .filter(deal=deal)
            .values_list("id", flat=True),
        ),
        "quote": _prefetched_ids(
            "_history_quotes",
            Quote.objects.with_deleted().filter(deal=deal).values_list("id", flat=True),
        ),
    }


def get_related_audit_logs(deal: Deal, related_ids=None):
    filters = Q(object_type="deal", object_id=str(deal.id))
    related_ids = related_ids or collect_related_ids(deal)
    for object_type, ids in related_ids.items():
        if ids:
            filters |= Q(object_type=object_type, object_id__in=ids)
    return (
        AuditLog.objects.filter(filters).select_related("actor").order_by("-created_at")
    )


def map_audit_log_entry(audit_log: AuditLog, deal_id):
    action_display = audit_log.get_action_display()
    description = audit_log.description or audit_log.object_name or action_display
    return {
        "id": f"audit-{audit_log.id}",
        "deal": str(deal_id),
        "object_type": audit_log.object_type,
        "object_id": audit_log.object_id,
        "object_name": audit_log.object_name,
        "action_type": "custom",
        "action_type_display": action_display,
        "description": description,
        "user": audit_log.actor_id,
        "user_username": audit_log.actor.username if audit_log.actor else None,
        "old_value": _format_value(audit_log.old_value),
        "new_value": _format_value(audit_log.new_value),
        "created_at": audit_log.created_at.isoformat(),
    }
