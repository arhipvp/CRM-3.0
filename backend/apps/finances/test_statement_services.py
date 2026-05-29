from decimal import Decimal
from types import SimpleNamespace

from apps.finances.models import FinancialRecord
from apps.finances.services.statements import (
    ensure_unique_zip_path,
    normalize_statement_amount,
    quantize_money,
    sanitize_drive_filename,
)


def test_sanitize_drive_filename_preserves_cyrillic_and_removes_forbidden_chars():
    assert (
        sanitize_drive_filename('  Ведомость: "СК/Тест"*  ') == "Ведомость_ _СК_Тест_"
    )


def test_ensure_unique_zip_path_adds_suffixes_without_duplicates():
    seen = set()

    assert ensure_unique_zip_path("report.xlsx", seen) == "report.xlsx"
    assert ensure_unique_zip_path("report.xlsx", seen) == "report (1).xlsx"
    assert ensure_unique_zip_path("report.xlsx", seen) == "report (2).xlsx"


def test_quantize_money_uses_two_decimal_places():
    assert quantize_money(Decimal("10.005")) == Decimal("10.01")


def test_normalize_statement_amount_uses_record_type_or_amount_fallback():
    income = SimpleNamespace(
        record_type=FinancialRecord.RecordType.INCOME, amount=Decimal("1")
    )
    expense_without_type = SimpleNamespace(record_type="", amount=Decimal("-1"))

    assert normalize_statement_amount(income, Decimal("100")) == Decimal("100")
    assert normalize_statement_amount(expense_without_type, Decimal("100")) == Decimal(
        "-100"
    )
