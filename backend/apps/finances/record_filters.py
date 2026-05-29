from apps.finances.models import FinancialRecord, Statement
from django.db.models import Q

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
    payment_id = params.get("payment")
    if payment_id:
        queryset = queryset.filter(payment_id=payment_id)

    deal_id = params.get("deal")
    if deal_id:
        queryset = queryset.filter(
            Q(payment__policy__deal_id=deal_id) | Q(payment__deal_id=deal_id)
        ).distinct()

    policy_id = params.get("policy")
    if policy_id:
        queryset = queryset.filter(payment__policy_id=policy_id)

    sales_channel_id = params.get("sales_channel")
    if sales_channel_id:
        queryset = queryset.filter(payment__policy__sales_channel_id=sales_channel_id)

    scheduled_date_from = params.get("payment_scheduled_date_from")
    if scheduled_date_from:
        queryset = queryset.filter(payment__scheduled_date__gte=scheduled_date_from)

    scheduled_date_to = params.get("payment_scheduled_date_to")
    if scheduled_date_to:
        queryset = queryset.filter(payment__scheduled_date__lte=scheduled_date_to)

    statement_id = params.get("statement")
    if statement_id:
        queryset = queryset.filter(statement_id=statement_id)

    record_type = params.get("record_type")
    if record_type == Statement.TYPE_INCOME:
        queryset = queryset.filter(record_type=FinancialRecord.RecordType.INCOME)
    elif record_type == Statement.TYPE_EXPENSE:
        queryset = queryset.filter(record_type=FinancialRecord.RecordType.EXPENSE)

    if parse_bool(params.get("unpaid_only")):
        queryset = queryset.filter(date__isnull=True)

    if parse_bool(params.get("paid_only")):
        queryset = queryset.filter(date__isnull=False)

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
