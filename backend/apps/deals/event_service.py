from __future__ import annotations

from decimal import Decimal
from typing import Any

from apps.finances.models import Payment
from apps.policies.models import Policy
from apps.users.models import AuditLog
from django.db.models import Q
from django.utils import timezone

from .history_utils import collect_related_ids, get_related_audit_logs
from .models import Deal, DealEvent

EVENT_LIMIT = 250


def _user_display(user) -> str | None:
    if not user:
        return None
    full_name = f"{user.first_name} {user.last_name}".strip()
    return full_name or user.username


def _money(value: Decimal | None) -> str:
    if value is None:
        return ""
    normalized = value.quantize(Decimal("0.01"))
    return f"{normalized:,.2f}".replace(",", " ").replace(".00", "") + " ₽"


def _event_payload(
    *,
    event_id: str,
    deal: Deal,
    event_type: str,
    event_date,
    title: str,
    description: str = "",
    source_type: str = "",
    source_id: str = "",
    actor=None,
    metadata: dict[str, Any] | None = None,
    created_at=None,
) -> dict[str, Any]:
    created_at = created_at or timezone.now()
    return {
        "id": event_id,
        "deal": str(deal.id),
        "event_type": event_type,
        "event_type_display": dict(DealEvent.EventType.choices).get(event_type, title),
        "event_date": event_date,
        "title": title,
        "description": description,
        "source_type": source_type,
        "source_id": source_id,
        "actor": str(actor.id) if actor else None,
        "actor_username": getattr(actor, "username", None) if actor else None,
        "actor_display_name": _user_display(actor),
        "metadata": metadata or {},
        "created_at": created_at,
    }


def create_manual_date_event(
    *,
    deal: Deal,
    event_type: str,
    event_date,
    actor=None,
    old_value=None,
    new_value=None,
) -> DealEvent | None:
    if event_type not in {
        DealEvent.EventType.MANUAL_EXPECTED_CLOSE,
        DealEvent.EventType.MANUAL_NEXT_CONTACT,
    }:
        return None
    if old_value == new_value:
        return None

    if event_type == DealEvent.EventType.MANUAL_EXPECTED_CLOSE:
        title = "Дата «Застраховать до» выставлена вручную"
        description = f"Дата изменена с {old_value or '—'} на {new_value or '—'}."
    else:
        title = "Следующий контакт выставлен вручную"
        description = f"Дата следующего контакта изменена с {old_value or '—'} на {new_value or '—'}."

    return DealEvent.objects.create(
        deal=deal,
        event_type=event_type,
        event_date=event_date,
        title=title,
        description=description,
        source_type="deal",
        source_id=str(deal.id),
        actor=actor if actor and actor.is_authenticated else None,
        metadata={
            "old_value": str(old_value) if old_value else None,
            "new_value": str(new_value) if new_value else None,
        },
    )


def _stored_events(deal: Deal) -> list[dict[str, Any]]:
    return [
        _event_payload(
            event_id=f"deal-event-{event.id}",
            deal=deal,
            event_type=event.event_type,
            event_date=event.event_date,
            title=event.title,
            description=event.description,
            source_type=event.source_type,
            source_id=event.source_id,
            actor=event.actor,
            metadata=event.metadata,
            created_at=event.created_at,
        )
        for event in deal.events.select_related("actor").all()
    ]


def _payment_events(deal: Deal) -> list[dict[str, Any]]:
    payments = (
        Payment.objects.filter(
            Q(deal=deal) | Q(policy__deal=deal),
            deleted_at__isnull=True,
            actual_date__isnull=True,
            scheduled_date__isnull=False,
        )
        .select_related("policy")
        .order_by("scheduled_date", "-created_at")
        .distinct()
    )
    events = []
    for payment in payments:
        parts = []
        if payment.description:
            parts.append(payment.description)
        if payment.policy_id and payment.policy.number:
            parts.append(f"полис {payment.policy.number}")
        amount = _money(payment.amount)
        if amount:
            parts.append(amount)
        events.append(
            _event_payload(
                event_id=f"payment-due-{payment.id}",
                deal=deal,
                event_type=DealEvent.EventType.PAYMENT_DUE,
                event_date=payment.scheduled_date,
                title="Очередной платеж",
                description=" · ".join(parts) or "Запланирован неоплаченный платеж.",
                source_type="payment",
                source_id=str(payment.id),
                metadata={
                    "amount": str(payment.amount),
                    "policy_id": str(payment.policy_id) if payment.policy_id else None,
                    "policy_number": (
                        payment.policy.number if payment.policy_id else None
                    ),
                },
                created_at=payment.created_at,
            )
        )
    return events


def _policy_events(deal: Deal) -> list[dict[str, Any]]:
    policies = (
        Policy.objects.filter(
            deal=deal,
            deleted_at__isnull=True,
            end_date__isnull=False,
        )
        .filter(Q(is_renewed=False) | Q(is_renewed__isnull=True))
        .select_related("insurance_company", "insurance_type")
        .order_by("end_date", "-created_at")
    )
    events = []
    for policy in policies:
        details = [f"полис {policy.number}"] if policy.number else []
        if policy.insurance_type_id:
            details.append(policy.insurance_type.name)
        if policy.insurance_company_id:
            details.append(policy.insurance_company.name)
        events.append(
            _event_payload(
                event_id=f"policy-expiration-{policy.id}",
                deal=deal,
                event_type=DealEvent.EventType.POLICY_EXPIRATION,
                event_date=policy.end_date,
                title="Окончание полиса",
                description=" · ".join(details)
                or "Заканчивается срок действия полиса.",
                source_type="policy",
                source_id=str(policy.id),
                metadata={"policy_number": policy.number},
                created_at=policy.created_at,
            )
        )
    return events


def _audit_event_type(log: AuditLog) -> str:
    if log.object_type == "task" and log.action == "create":
        return DealEvent.EventType.TASK_CREATED
    if log.object_type == "task" and log.action == "update":
        new_status = (log.new_value or {}).get("status")
        if new_status == "done":
            return DealEvent.EventType.TASK_COMPLETED
    if log.object_type == "policy" and log.action == "create":
        return DealEvent.EventType.POLICY_CREATED
    if log.object_type == "quote" and log.action == "create":
        return DealEvent.EventType.QUOTE_CREATED
    if log.object_type == "document" and log.action == "create":
        return DealEvent.EventType.FILE_UPLOADED
    return DealEvent.EventType.DEAL_UPDATED


def _audit_events(deal: Deal) -> list[dict[str, Any]]:
    related_ids = collect_related_ids(deal)
    events = []
    for log in get_related_audit_logs(deal, related_ids=related_ids):
        event_type = _audit_event_type(log)
        events.append(
            _event_payload(
                event_id=f"audit-{log.id}",
                deal=deal,
                event_type=event_type,
                event_date=log.created_at.date(),
                title=log.get_action_display(),
                description=log.description
                or log.object_name
                or log.get_action_display(),
                source_type=log.object_type,
                source_id=log.object_id,
                actor=log.actor,
                metadata={
                    "audit_action": log.action,
                    "object_name": log.object_name,
                },
                created_at=log.created_at,
            )
        )
    return events


def get_deal_events(deal: Deal) -> list[dict[str, Any]]:
    events = [
        *_stored_events(deal),
        *_payment_events(deal),
        *_policy_events(deal),
        *_audit_events(deal),
    ]
    events.sort(
        key=lambda item: (
            item["event_date"] or timezone.localdate(item["created_at"]),
            item["created_at"],
            item["id"],
        ),
        reverse=True,
    )
    return events[:EVENT_LIMIT]
