from __future__ import annotations

from dataclasses import dataclass

from apps.finances.models import FinancialRecord, Payment
from django.db.models import Exists, OuterRef, QuerySet
from django.utils import timezone

from .models import Policy


@dataclass(frozen=True)
class PolicyComputedStatus:
    PROBLEM: str = "problem"
    DUE: str = "due"
    EXPIRED: str = "expired"
    ACTIVE: str = "active"


STATUS_VALUES = PolicyComputedStatus()


def with_computed_status_flags(queryset: QuerySet[Policy]) -> QuerySet[Policy]:
    unpaid_payment_exists = Payment.objects.filter(
        policy=OuterRef("pk"),
        deleted_at__isnull=True,
        actual_date__isnull=True,
    )
    unpaid_record_exists = FinancialRecord.objects.filter(
        payment__policy=OuterRef("pk"),
        payment__deleted_at__isnull=True,
        deleted_at__isnull=True,
        date__isnull=True,
    )
    return queryset.annotate(
        has_unpaid_payment=Exists(unpaid_payment_exists),
        has_unpaid_record=Exists(unpaid_record_exists),
    )


def resolve_computed_status(policy: Policy) -> str:
    has_unpaid_record = bool(getattr(policy, "has_unpaid_record", False))
    if has_unpaid_record:
        return STATUS_VALUES.PROBLEM

    has_unpaid_payment = bool(getattr(policy, "has_unpaid_payment", False))
    if has_unpaid_payment:
        return STATUS_VALUES.DUE

    if policy.end_date and policy.end_date < timezone.localdate():
        return STATUS_VALUES.EXPIRED

    return STATUS_VALUES.ACTIVE
