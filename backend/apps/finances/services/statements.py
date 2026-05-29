import re
from decimal import ROUND_HALF_UP, Decimal

from django.db.models import DecimalField, OuterRef, Prefetch, Subquery, Sum, Value
from django.db.models.functions import Coalesce

from ..models import FinancialRecord


def records_with_paid_balance(statement):
    paid_balance_subquery = (
        FinancialRecord.objects.filter(
            payment_id=OuterRef("payment_id"),
            date__isnull=False,
            deleted_at__isnull=True,
        )
        .order_by()
        .values("payment_id")
        .annotate(total=Sum("amount"))
        .values("total")[:1]
    )
    return (
        FinancialRecord.objects.filter(statement=statement, deleted_at__isnull=True)
        .select_related(
            "payment",
            "payment__policy",
            "payment__policy__deal",
            "payment__policy__deal__client",
            "payment__policy__insurance_type",
            "payment__policy__sales_channel",
            "payment__deal",
            "payment__deal__client",
        )
        .prefetch_related(
            Prefetch(
                "payment__financial_records",
                queryset=FinancialRecord.objects.filter(
                    date__isnull=False,
                    deleted_at__isnull=True,
                )
                .only("id", "amount", "date", "payment_id")
                .order_by("-date", "-amount", "id"),
                to_attr="paid_records",
            )
        )
        .annotate(
            payment_paid_balance=Coalesce(
                Subquery(
                    paid_balance_subquery,
                    output_field=DecimalField(max_digits=12, decimal_places=2),
                ),
                0,
                output_field=DecimalField(max_digits=12, decimal_places=2),
            )
        )
        .order_by("created_at", "id")
    )


def normalize_statement_amount(record, amount):
    record_type = record.record_type
    if record_type not in FinancialRecord.RecordType.values:
        record_type = FinancialRecord.infer_record_type_from_amount(record.amount)
    return FinancialRecord.normalize_amount_for_record_type(record_type, amount)


def quantize_money(value):
    return Decimal(value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def sanitize_drive_filename(value: str) -> str:
    clean = (value or "").strip() or "Ведомость"
    clean = re.sub(r'[\\\\/:*?"<>|]+', "_", clean)
    clean = re.sub(r"\s+", " ", clean).strip()
    return clean[:120] if len(clean) > 120 else clean


def ensure_unique_zip_path(path: str, seen: set[str]) -> str:
    if path not in seen:
        seen.add(path)
        return path

    suffix = 1
    base, dot, ext = path.partition(".")
    while True:
        candidate = f"{base} ({suffix}){dot}{ext}" if ext else f"{base} ({suffix})"
        if candidate not in seen:
            seen.add(candidate)
            return candidate
        suffix += 1
