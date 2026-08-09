from io import BytesIO

from apps.common.drive import (
    ensure_finance_exports_folder,
    ensure_statement_folder,
    upload_file_to_drive,
)
from apps.deals.permissions import build_deal_visibility_q
from django.db.models import F, Prefetch, Q
from django.utils import timezone
from openpyxl import Workbook

from ..models import FinancialRecord, Statement
from ..permissions import is_admin_user
from ..record_filters import apply_financial_record_filters
from .statements import sanitize_drive_filename

MIME_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _visible_records(user):
    queryset = FinancialRecord.objects.select_related(
        "payment",
        "payment__policy",
        "payment__policy__client",
        "payment__policy__insured_client",
        "payment__policy__deal",
        "payment__policy__deal__client",
        "payment__policy__insurance_type",
        "payment__policy__sales_channel",
        "payment__deal",
        "payment__deal__client",
        "statement",
    ).prefetch_related(
        Prefetch(
            "payment__financial_records",
            queryset=FinancialRecord.objects.filter(date__isnull=False).only(
                "id", "amount", "date", "payment_id"
            ),
            to_attr="paid_records",
        )
    )
    if not is_admin_user(user):
        queryset = queryset.filter(
            build_deal_visibility_q(user, prefix="payment__policy__deal__")
            | build_deal_visibility_q(user, prefix="payment__deal__")
        ).distinct()
    return queryset.annotate(payment_paid_balance=F("payment__paid_balance"))


def _apply_search(queryset, value):
    search = (value or "").strip()
    if not search:
        return queryset
    return queryset.filter(
        Q(payment__policy__number__icontains=search)
        | Q(payment__policy__client__name__icontains=search)
        | Q(payment__policy__insured_client__name__icontains=search)
        | Q(payment__policy__deal__title__icontains=search)
        | Q(payment__deal__title__icontains=search)
        | Q(payment__description__icontains=search)
        | Q(description__icontains=search)
        | Q(source__icontains=search)
        | Q(note__icontains=search)
    )


def _write_records_workbook(records, title):
    workbook = Workbook(write_only=True)
    sheet = workbook.create_sheet(title=title)
    sheet.append(
        [
            "Клиент / сделка",
            "Полис",
            "Канал",
            "Дата платежа",
            "Платёж, ₽",
            "Проведённые операции",
            "Сальдо, ₽",
            "Комментарий",
            "Сумма, ₽",
        ]
    )
    for record in records.iterator(chunk_size=500):
        payment = record.payment
        policy = payment.policy
        deal = payment.deal or (policy.deal if policy else None)
        client = (policy.client or policy.insured_client) if policy else None
        client = client or (deal.client if deal else None)
        entries = getattr(payment, "paid_records", [])
        operations = (
            "\n".join(
                f"{'Доход' if entry.amount >= 0 else 'Расход'} {abs(entry.amount)} · {entry.date:%d.%m.%Y}"
                for entry in entries
            )
            or "Операций нет"
        )
        comment = record.note or record.description or record.source or "—"
        sheet.append(
            [
                f"{getattr(client, 'name', '—')}\n{getattr(deal, 'title', '—')}",
                getattr(policy, "number", "—") if policy else "—",
                getattr(getattr(policy, "sales_channel", None), "name", "—"),
                payment.scheduled_date,
                payment.amount,
                operations,
                payment.paid_balance,
                comment,
                abs(record.amount),
            ]
        )
    buffer = BytesIO()
    workbook.save(buffer)
    buffer.seek(0)
    return buffer


def export_financial_records(*, user, filters):
    records = apply_financial_record_filters(_visible_records(user), filters)
    records = _apply_search(records, filters.get("search")).order_by(
        "-date", "-created_at"
    )
    folder_id = ensure_finance_exports_folder()
    timestamp = timezone.localtime().strftime("%d_%m_%Y_%H_%M_%S")
    filename = f"financial_records_{timestamp}.xlsx"
    drive_file = upload_file_to_drive(
        folder_id,
        _write_records_workbook(records, "Финансовые записи"),
        filename,
        MIME_XLSX,
    )
    return {"folder_id": folder_id, "file": drive_file}


def export_statement(*, user, statement_id):
    statement = Statement.objects.get(pk=statement_id)
    records = _visible_records(user).filter(statement=statement)
    if (
        not is_admin_user(user)
        and statement.created_by_id != user.id
        and not records.exists()
    ):
        raise Statement.DoesNotExist
    folder_id = statement.drive_folder_id or ensure_statement_folder(statement)
    timestamp = timezone.localtime().strftime("%d_%m_%Y_%H_%M_%S")
    filename = f"{sanitize_drive_filename(statement.name)}_{timestamp}.xlsx"
    drive_file = upload_file_to_drive(
        folder_id,
        _write_records_workbook(records.order_by("created_at"), "Ведомость"),
        filename,
        MIME_XLSX,
    )
    return {"folder_id": folder_id, "file": drive_file}
