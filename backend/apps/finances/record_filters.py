from apps.finances.models import Statement

from .permissions import parse_bool


def apply_financial_record_filters(queryset, params):
    record_type = params.get("record_type")
    if record_type == Statement.TYPE_INCOME:
        queryset = queryset.filter(amount__gt=0)
    elif record_type == Statement.TYPE_EXPENSE:
        queryset = queryset.filter(amount__lt=0)

    if parse_bool(params.get("unpaid_only")):
        queryset = queryset.filter(date__isnull=True)

    if parse_bool(params.get("without_statement")):
        queryset = queryset.filter(statement__isnull=True)

    if parse_bool(params.get("paid_balance_not_zero")):
        queryset = queryset.exclude(payment_paid_balance=0)

    return queryset
