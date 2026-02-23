from __future__ import annotations

from apps.deals.models import Deal
from apps.finances.models import FinancialRecord, Payment
from apps.tasks.models import Task
from django.db.models import Count, DecimalField, Q, Sum, Value
from django.db.models.functions import Coalesce, TruncDate

from .dashboard import format_amount
from .models import Policy


def build_seller_dashboard_payload(*, user, start_date, end_date) -> dict:
    decimal_field = DecimalField(max_digits=12, decimal_places=2)
    queryset = (
        Policy.objects.filter(
            deal__seller=user,
            start_date__isnull=False,
            start_date__gte=start_date,
            start_date__lte=end_date,
        )
        .select_related(
            "insurance_company",
            "insurance_type",
            "client",
            "insured_client",
        )
        .annotate(
            paid_amount=Coalesce(
                Sum(
                    "payments__amount",
                    filter=Q(payments__actual_date__isnull=False),
                ),
                Value(0),
                output_field=decimal_field,
            )
        )
        .order_by("-start_date", "-created_at")
    )

    total_paid = format_amount(
        queryset.aggregate(
            total=Coalesce(
                Sum(
                    "payments__amount",
                    filter=Q(payments__actual_date__isnull=False),
                ),
                Value(0),
                output_field=decimal_field,
            )
        )["total"]
    )

    policies = []
    for policy in queryset:
        policies.append(
            {
                "id": policy.id,
                "number": policy.number,
                "insurance_company": (
                    policy.insurance_company.name if policy.insurance_company else ""
                ),
                "insurance_type": (
                    policy.insurance_type.name if policy.insurance_type else ""
                ),
                "client_name": policy.client.name if policy.client else None,
                "insured_client_name": (
                    policy.insured_client.name if policy.insured_client else None
                ),
                "start_date": policy.start_date,
                "paid_amount": format_amount(policy.paid_amount),
            }
        )

    tasks_queryset = Task.objects.filter(deal__seller=user, deleted_at__isnull=True)
    tasks_current = tasks_queryset.exclude(
        status__in=[Task.TaskStatus.DONE, Task.TaskStatus.CANCELED]
    ).count()
    tasks_completed = tasks_queryset.filter(
        status=Task.TaskStatus.DONE,
        completed_at__date__gte=start_date,
        completed_at__date__lte=end_date,
    ).count()

    payments_by_day = (
        Payment.objects.filter(
            policy__deal__seller=user,
            policy__start_date__isnull=False,
            policy__start_date__gte=start_date,
            policy__start_date__lte=end_date,
            actual_date__isnull=False,
            actual_date__gte=start_date,
            actual_date__lte=end_date,
        )
        .values("actual_date")
        .annotate(
            total=Coalesce(
                Sum("amount"),
                Value(0),
                output_field=decimal_field,
            )
        )
        .order_by("actual_date")
    )
    payments_series = [
        {"date": item["actual_date"], "total": format_amount(item["total"])}
        for item in payments_by_day
    ]

    tasks_completed_by_day = (
        tasks_queryset.filter(
            status=Task.TaskStatus.DONE,
            completed_at__date__gte=start_date,
            completed_at__date__lte=end_date,
        )
        .annotate(day=TruncDate("completed_at"))
        .values("day")
        .annotate(count=Count("id"))
        .order_by("day")
    )
    tasks_series = [
        {"date": item["day"], "count": item["count"]} for item in tasks_completed_by_day
    ]

    tasks_completed_by_executor = (
        tasks_queryset.filter(
            status=Task.TaskStatus.DONE,
            completed_at__date__gte=start_date,
            completed_at__date__lte=end_date,
        )
        .annotate(day=TruncDate("completed_at"))
        .values(
            "day",
            "assignee_id",
            "assignee__first_name",
            "assignee__last_name",
            "assignee__username",
        )
        .annotate(count=Count("id"))
        .order_by("day")
    )
    tasks_executor_series = []
    for item in tasks_completed_by_executor:
        first_name = (item.get("assignee__first_name") or "").strip()
        last_name = (item.get("assignee__last_name") or "").strip()
        full_name = f"{first_name} {last_name}".strip()
        executor_name = full_name or item.get("assignee__username") or "Неизвестный"
        tasks_executor_series.append(
            {
                "date": item["day"],
                "executor_id": item.get("assignee_id"),
                "executor_name": executor_name,
                "count": item["count"],
            }
        )

    closed_statuses = [Deal.DealStatus.WON, Deal.DealStatus.LOST]
    policy_expirations_by_day = (
        Policy.objects.filter(
            deal__seller=user,
            deal__deleted_at__isnull=True,
            end_date__isnull=False,
            end_date__gte=start_date,
            end_date__lte=end_date,
        )
        .exclude(deal__status__in=closed_statuses)
        .values("end_date")
        .annotate(count=Count("id"))
        .order_by("end_date")
    )
    policy_expirations_series = [
        {"date": item["end_date"], "count": item["count"]}
        for item in policy_expirations_by_day
    ]

    next_contacts_by_day = (
        Deal.objects.filter(
            seller=user,
            deleted_at__isnull=True,
            next_contact_date__gte=start_date,
            next_contact_date__lte=end_date,
        )
        .exclude(status__in=closed_statuses)
        .values("next_contact_date")
        .annotate(count=Count("id"))
        .order_by("next_contact_date")
    )
    next_contacts_series = [
        {"date": item["next_contact_date"], "count": item["count"]}
        for item in next_contacts_by_day
    ]

    records_queryset = FinancialRecord.objects.filter(
        deleted_at__isnull=True,
        date__isnull=False,
        payment__policy__isnull=False,
        payment__policy__deal__seller=user,
        payment__policy__start_date__isnull=False,
        payment__policy__start_date__gte=start_date,
        payment__policy__start_date__lte=end_date,
    )

    records_totals = records_queryset.aggregate(
        income_total=Coalesce(
            Sum("amount", filter=Q(amount__gt=0)),
            Value(0),
            output_field=decimal_field,
        ),
        expense_total_raw=Coalesce(
            Sum("amount", filter=Q(amount__lt=0)),
            Value(0),
            output_field=decimal_field,
        ),
        net_total=Coalesce(
            Sum("amount"),
            Value(0),
            output_field=decimal_field,
        ),
        records_count=Count("id"),
    )
    expenses_total_raw = records_totals.get("expense_total_raw") or 0
    expenses_total = abs(expenses_total_raw)

    grouped_financial_rows = (
        records_queryset.values(
            "payment__policy__insurance_company_id",
            "payment__policy__insurance_company__name",
            "payment__policy__insurance_type_id",
            "payment__policy__insurance_type__name",
        )
        .annotate(
            income_total=Coalesce(
                Sum("amount", filter=Q(amount__gt=0)),
                Value(0),
                output_field=decimal_field,
            ),
            expense_total_raw=Coalesce(
                Sum("amount", filter=Q(amount__lt=0)),
                Value(0),
                output_field=decimal_field,
            ),
            net_total=Coalesce(
                Sum("amount"),
                Value(0),
                output_field=decimal_field,
            ),
            records_count=Count("id"),
        )
        .order_by(
            "payment__policy__insurance_company__name",
            "payment__policy__insurance_type__name",
        )
    )

    financial_by_company_type = []
    for row in grouped_financial_rows:
        company_name = (
            row.get("payment__policy__insurance_company__name") or ""
        ).strip()
        insurance_type_name = (
            row.get("payment__policy__insurance_type__name") or ""
        ).strip()
        expense_raw = row.get("expense_total_raw") or 0
        financial_by_company_type.append(
            {
                "insurance_company_id": row.get(
                    "payment__policy__insurance_company_id"
                ),
                "insurance_company_name": company_name or "Не указано",
                "insurance_type_id": row.get("payment__policy__insurance_type_id"),
                "insurance_type_name": insurance_type_name or "Не указано",
                "income_total": format_amount(row.get("income_total")),
                "expense_total": format_amount(abs(expense_raw)),
                "net_total": format_amount(row.get("net_total")),
                "records_count": row.get("records_count") or 0,
            }
        )

    return {
        "start_date": start_date,
        "end_date": end_date,
        "total_paid": total_paid,
        "tasks_current": tasks_current,
        "tasks_completed": tasks_completed,
        "payments_by_day": payments_series,
        "tasks_completed_by_day": tasks_series,
        "tasks_completed_by_executor": tasks_executor_series,
        "policy_expirations_by_day": policy_expirations_series,
        "next_contacts_by_day": next_contacts_series,
        "financial_totals": {
            "income_total": format_amount(records_totals.get("income_total")),
            "expense_total": format_amount(expenses_total),
            "net_total": format_amount(records_totals.get("net_total")),
            "records_count": records_totals.get("records_count") or 0,
        },
        "financial_by_company_type": financial_by_company_type,
        "policies": policies,
    }
