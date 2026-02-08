from apps.finances.models import Statement

from .permissions import parse_bool


def _parse_nullable_bool(value):
    if value is None:
        return None
    raw = str(value).strip().lower()
    if raw == "":
        return None
    if raw in {"1", "true", "yes", "y", "on"}:
        return True
    if raw in {"0", "false", "no", "n", "off"}:
        return False
    return None


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

    payment_paid = _parse_nullable_bool(params.get("payment_paid"))
    if payment_paid is True:
        queryset = queryset.filter(payment__actual_date__isnull=False)
    elif payment_paid is False:
        queryset = queryset.filter(payment__actual_date__isnull=True)

    return queryset
