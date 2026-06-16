from decimal import Decimal

from apps.clients.models import Client
from apps.deals.models import Deal
from apps.finances.models import FinancialRecord, Payment
from django.db import transaction
from rest_framework.exceptions import PermissionDenied, ValidationError

from ..models import Policy
from ..permissions import user_can_modify_deal
from .files import (
    detach_source_files_from_notes,
    move_recognized_files_to_policy_folder,
    normalize_source_file_ids,
)

POLICY_DRAFT_FIELDS = (
    "number",
    "insurance_company",
    "insurance_type",
    "client",
    "is_vehicle",
    "brand",
    "model",
    "vin",
    "deductible",
    "official_dealer",
    "gap",
    "counterparty",
    "note",
    "sales_channel",
    "start_date",
    "end_date",
)


def _resolve_client(deal: Deal, data: dict) -> Client | None:
    client = data.get("client")
    client_name = (data.get("client_name") or "").strip()
    if client:
        return client
    if not client_name:
        return deal.client

    if deal.client and deal.client.name.casefold() == client_name.casefold():
        return deal.client

    existing = Client.objects.filter(name__iexact=client_name).first()
    if existing:
        return existing
    return Client.objects.create(name=client_name)


def _ensure_edit_allowed(user, policy: Policy | None, deal: Deal) -> None:
    if not user or not user.is_authenticated:
        raise PermissionDenied("Нет доступа к сделке.")
    if policy is None:
        if deal.seller_id != user.id:
            raise PermissionDenied("Только продавец сделки может добавлять полис.")
        return
    if not user_can_modify_deal(user, policy.deal):
        raise PermissionDenied("Нет доступа к сделке.")


def _record_statement_error(record: FinancialRecord, delete: bool) -> None:
    statement = getattr(record, "statement", None)
    if not statement:
        return
    if statement.paid_at:
        message = (
            "Нельзя удалить запись из выплаченной ведомости."
            if delete
            else "Нельзя изменять записи в выплаченной ведомости."
        )
        raise ValidationError({"detail": message})
    if delete:
        raise ValidationError({"detail": "Сначала уберите запись из ведомости"})


def _payment_statement_error(payment: Payment) -> None:
    for record in payment.financial_records.filter(deleted_at__isnull=True):
        _record_statement_error(record, delete=True)


def _record_has_changes(
    record: FinancialRecord,
    *,
    amount: Decimal,
    record_type: str,
    date,
    description: str,
    source: str,
    note: str,
) -> bool:
    return (
        record.amount != amount
        or record.record_type != record_type
        or record.date != date
        or (record.description or "") != description
        or (record.source or "") != source
        or (record.note or "") != note
    )


def _apply_records(payment: Payment, drafts: list[dict], record_type: str) -> set:
    submitted_ids = {draft["id"] for draft in drafts if draft.get("id")}
    existing_records = {
        record.id: record
        for record in payment.financial_records.filter(
            deleted_at__isnull=True,
        ).select_related("statement")
    }

    for draft in drafts:
        amount = FinancialRecord.normalize_amount_for_record_type(
            record_type,
            draft["amount"],
        )
        payload = {
            "amount": amount,
            "record_type": record_type,
            "date": draft.get("date"),
            "description": draft.get("description") or "",
            "source": draft.get("source") or "",
            "note": draft.get("note") or "",
        }
        record_id = draft.get("id")
        if record_id:
            record = existing_records.get(record_id)
            if not record:
                raise ValidationError({"detail": "Финансовая запись не найдена."})
            if _record_has_changes(record, **payload):
                _record_statement_error(record, delete=False)
                for field, value in payload.items():
                    setattr(record, field, value)
                record.save()
            continue

        record = FinancialRecord.objects.create(
            payment=payment,
            **payload,
        )
        submitted_ids.add(record.id)

    return submitted_ids


def _apply_payment_records(payment: Payment, draft: dict) -> None:
    submitted_ids = set()
    submitted_ids |= _apply_records(
        payment,
        draft.get("incomes") or [],
        FinancialRecord.RecordType.INCOME,
    )
    submitted_ids |= _apply_records(
        payment,
        draft.get("expenses") or [],
        FinancialRecord.RecordType.EXPENSE,
    )

    records_to_delete = payment.financial_records.filter(
        deleted_at__isnull=True,
    ).exclude(id__in=submitted_ids)
    for record in records_to_delete.select_related("statement"):
        _record_statement_error(record, delete=True)
        record.delete()


def _apply_payments(policy: Policy, drafts: list[dict]) -> None:
    existing_payments = {
        payment.id: payment
        for payment in Payment.objects.filter(
            policy=policy,
            deleted_at__isnull=True,
        ).prefetch_related("financial_records")
    }
    submitted_ids = {draft["id"] for draft in drafts if draft.get("id")}

    for payment in existing_payments.values():
        if payment.id not in submitted_ids:
            _payment_statement_error(payment)
            payment.delete()

    for draft in drafts:
        payment_id = draft.get("id")
        payload = {
            "amount": draft["amount"],
            "description": draft.get("description") or "",
            "scheduled_date": draft.get("scheduled_date"),
            "actual_date": draft.get("actual_date"),
            "deal": policy.deal,
        }
        if payment_id:
            payment = existing_payments.get(payment_id)
            if not payment:
                raise ValidationError({"detail": "Платёж не найден."})
            for field, value in payload.items():
                setattr(payment, field, value)
            payment.save()
        else:
            payment = Payment.objects.create(policy=policy, **payload)
        _apply_payment_records(payment, draft)


def _refresh_policy_graph(policy: Policy) -> tuple[Policy, list[Payment]]:
    policy = (
        Policy.objects.alive()
        .select_related(
            "deal",
            "client",
            "insured_client",
            "insurance_company",
            "insurance_type",
            "sales_channel",
        )
        .get(pk=policy.pk)
    )
    payments = list(
        Payment.objects.filter(policy=policy, deleted_at__isnull=True)
        .select_related("policy", "deal")
        .prefetch_related("financial_records")
        .order_by("-created_at")
    )
    return policy, payments


@transaction.atomic
def apply_policy_draft(
    *,
    user,
    data: dict,
    policy: Policy | None = None,
) -> tuple[Policy, list[Payment]]:
    deal = policy.deal if policy else data.get("deal")
    if not deal:
        raise ValidationError({"deal": "Укажите сделку для полиса."})
    _ensure_edit_allowed(user, policy, deal)

    source_file_id = data.pop("source_file_id", None)
    source_file_ids = data.pop("source_file_ids", []) or []
    payments = data.pop("payments", []) or []
    data["client"] = _resolve_client(deal, data)

    if policy is None:
        policy_data = {field: data.get(field) for field in POLICY_DRAFT_FIELDS}
        policy_data["deal"] = deal
        policy = Policy.objects.create(**policy_data)
    else:
        for field in POLICY_DRAFT_FIELDS:
            if field in data:
                setattr(policy, field, data[field])
        policy.save()

    _apply_payments(policy, payments)

    file_ids = normalize_source_file_ids(source_file_id, source_file_ids)
    if file_ids:
        move_recognized_files_to_policy_folder(policy, file_ids)
        detach_source_files_from_notes(policy.deal, file_ids)

    return _refresh_policy_graph(policy)
