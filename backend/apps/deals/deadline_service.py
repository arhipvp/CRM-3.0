from __future__ import annotations

from datetime import date

from django.db.models import Q

from .models import Deal, DealEvent


def _earliest(*values: date | None) -> date | None:
    candidates = [value for value in values if value is not None]
    return min(candidates) if candidates else None


def calculate_deal_deadline(deal_id) -> date | None:
    from apps.finances.models import Payment
    from apps.policies.models import Policy

    deal_values = (
        Deal.objects.with_deleted()
        .filter(pk=deal_id)
        .values("manual_expected_close")
        .first()
    )
    if not deal_values:
        return None

    manual_deadline = deal_values["manual_expected_close"]
    policy_deadline = (
        Policy.objects.with_deleted()
        .filter(
            deal_id=deal_id,
            deleted_at__isnull=True,
            end_date__isnull=False,
            is_renewed=False,
        )
        .order_by("end_date")
        .values_list("end_date", flat=True)
        .first()
    )
    payment_deadline = (
        Payment.objects.with_deleted()
        .filter(
            Q(deal_id=deal_id) | Q(policy__deal_id=deal_id),
            deleted_at__isnull=True,
            actual_date__isnull=True,
            scheduled_date__isnull=False,
        )
        .order_by("scheduled_date")
        .values_list("scheduled_date", flat=True)
        .first()
    )
    return _earliest(manual_deadline, policy_deadline, payment_deadline)


def recalculate_deal_deadline(deal_id) -> date | None:
    if not deal_id:
        return None

    deadline = calculate_deal_deadline(deal_id)
    Deal.objects.with_deleted().filter(pk=deal_id).update(expected_close=deadline)
    return deadline


def sync_manual_expected_close_from_events(deal_id) -> date | None:
    manual_deadline = (
        DealEvent.objects.filter(
            deal_id=deal_id,
            event_type=DealEvent.EventType.MANUAL_EXPECTED_CLOSE,
            event_date__isnull=False,
        )
        .order_by("event_date", "created_at")
        .values_list("event_date", flat=True)
        .first()
    )
    Deal.objects.with_deleted().filter(pk=deal_id).update(
        manual_expected_close=manual_deadline
    )
    recalculate_deal_deadline(deal_id)
    return manual_deadline


def recalculate_deadline_for_payment(payment) -> None:
    deal_id = payment.deal_id
    if not deal_id and payment.policy_id:
        deal_id = getattr(getattr(payment, "policy", None), "deal_id", None)
        if not deal_id:
            from apps.policies.models import Policy

            deal_id = (
                Policy.objects.with_deleted()
                .filter(pk=payment.policy_id)
                .values_list("deal_id", flat=True)
                .first()
            )
    recalculate_deal_deadline(deal_id)
