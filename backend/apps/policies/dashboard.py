from datetime import date, timedelta
from decimal import Decimal

from django.utils.dateparse import parse_date


def get_month_bounds(target_date: date) -> tuple[date, date]:
    month_start = target_date.replace(day=1)
    if month_start.month == 12:
        next_month = date(month_start.year + 1, 1, 1)
    else:
        next_month = date(month_start.year, month_start.month + 1, 1)
    month_end = next_month - timedelta(days=1)
    return month_start, month_end


def format_amount(value: Decimal | int | None) -> str:
    if value is None:
        return "0.00"
    return format(Decimal(value).quantize(Decimal("0.01")), "f")


def parse_date_value(value: str | None) -> date | None:
    if not value:
        return None
    return parse_date(value)
