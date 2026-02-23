from __future__ import annotations

from apps.finances.models import FinancialRecord, Payment
from apps.finances.permissions import is_admin_user
from apps.finances.serializers import PaymentSerializer
from django.db.models import Q, Sum


def build_finance_summary_payload(*, user) -> dict:
    is_admin = is_admin_user(user)

    records_queryset = FinancialRecord.objects.filter(deleted_at__isnull=True)
    if not is_admin and user.is_authenticated:
        records_queryset = records_queryset.filter(
            Q(payment__deal__seller=user) | Q(payment__deal__executor=user)
        )

    incomes_total = (
        records_queryset.filter(amount__gt=0).aggregate(total=Sum("amount"))["total"]
        or 0
    )
    expenses_total = abs(
        records_queryset.filter(amount__lt=0).aggregate(total=Sum("amount"))["total"]
        or 0
    )
    net_total = incomes_total - expenses_total

    payments_queryset = Payment.objects.filter(
        actual_date__isnull=True, deleted_at__isnull=True
    )
    if not is_admin and user.is_authenticated:
        payments_queryset = payments_queryset.filter(
            Q(deal__seller=user) | Q(deal__executor=user)
        )

    planned_payments = payments_queryset.select_related("policy").order_by(
        "scheduled_date"
    )[:5]
    serializer = PaymentSerializer(planned_payments, many=True)

    return {
        "incomes_total": float(incomes_total),
        "expenses_total": float(expenses_total),
        "net_total": float(net_total),
        "planned_payments": serializer.data,
    }
