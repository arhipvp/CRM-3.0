from __future__ import annotations

import argparse
import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Iterable, Sequence

DEAL_TEMPLATE = (
    "INSERT INTO deals_deal ({cols}) VALUES ({vals});"
)
NOTE_TEMPLATE = "INSERT INTO notes_note ({cols}) VALUES ({vals});"

IMPORT_DATA_DIR = Path("import/data")


def parse_args():
    parser = argparse.ArgumentParser(description="Transform deal rows into INSERT statements.")
    parser.add_argument(
        "--dump",
        type=Path,
        default=IMPORT_DATA_DIR / "backup_2025-11-24_15-20.sql",
        help="SQL dump containing COPY for public.deal",
    )
    parser.add_argument(
        "--client-map",
        type=Path,
        default=IMPORT_DATA_DIR / "client_mapping.json",
        help="JSON file mapping legacy client IDs to UUIDs",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=IMPORT_DATA_DIR / "deal_import.sql",
        help="Target SQL file",
    )
    parser.add_argument(
        "--created-by",
        default="Vova",
        help="Username to reference for seller/executor",
    )
    return parser.parse_args()


def clean(value: str | None) -> str | None:
    if not value or value == "\N":
        return None
    return value


class RawSQL(str):
    pass


def escape(value: str | None) -> str | None:
    if value is None:
        return None
    safe = value.replace("'", "''")
    return safe.replace("\\n", "\n")


def quote(value: str | RawSQL | None) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, RawSQL):
        return str(value)
    return f"'{value}'"


def extract_rows(content: str) -> Iterable[Sequence[str]]:
    marker = "COPY public.deal"
    start = content.index(marker)
    end = content.index("\\n\\.", start)
    block = content[start:end].splitlines()[1:]
    for line in block:
        if not line.strip():
            continue
        parts = line.split("	")
        if len(parts) < 12:
            continue
        yield parts[:12]


def build_queries(
    rows: Iterable[Sequence[str]],
    client_map: dict[str, str],
    username: str,
    now: str,
) -> list[str]:
    queries: list[str] = []
    deal_columns = [
        "id",
        "deleted_at",
        "created_at",
        "updated_at",
        "title",
        "description",
        "client_id",
        "seller_id",
        "executor_id",
        "status",
        "stage_name",
        "expected_close",
        "next_contact_date",
        "next_review_date",
        "source",
        "loss_reason",
        "drive_folder_id",
    ]
    note_columns = [
        "id",
        "deleted_at",
        "created_at",
        "updated_at",
        "deal_id",
        "body",
        "author_name",
    ]
    seller_ref = RawSQL(f"(SELECT id FROM auth_user WHERE username = '{username}' LIMIT 1)")
    executor_ref = seller_ref

    for cols in rows:
        (
            legacy_id,
            client_id,
            start_date,
            status,
            description,
            calculations,
            reminder_date,
            is_closed,
            closed_reason,
            drive_path,
            drive_link,
            is_deleted,
        ) = cols
        client_uuid = client_map.get(client_id)
        if not client_uuid:
            continue
        title = description.strip() if description else f"Deal #{client_id}"
        description_parts = [description] if description else []
        drive_meta: dict[str, str] = {}
        if drive_path and drive_path != "\N":
            drive_meta["drive_folder_path"] = drive_path
        if drive_link and drive_link != "\N":
            drive_meta["drive_folder_link"] = drive_link
        if drive_meta:
            description_parts.append(json.dumps(drive_meta, ensure_ascii=False))
        full_description = "\n".join(part for part in description_parts if part)
        next_contact_date = reminder_date if reminder_date and reminder_date != "\N" else start_date
        status_value = status if status and status != "\N" else "open"
        loss_reason = closed_reason if closed_reason and closed_reason != "\N" else None
        if is_closed == "t":
            status_value = "closed"
            if not loss_reason:
                loss_reason = "Closed in import"
        if is_deleted == "t":
            continue
        deleted_at = now if is_closed == "t" else None
        deal_uuid = str(uuid.uuid5(uuid.NAMESPACE_URL, f"deals.deal:{legacy_id}"))
        title_value = escape(title)
        desc_value = escape(full_description)
        status_value = escape(status_value) or "open"
        loss_reason_value = escape(loss_reason) or ""
        next_contact = next_contact_date if next_contact_date and next_contact_date != "\N" else None
        source_value = ""
        values = [
            deal_uuid,
            deleted_at,
            now,
            now,
            title_value,
            desc_value,
            client_uuid,
            seller_ref,
            executor_ref,
            status_value,
            "",
            None,
            next_contact,
            None,
            source_value,
            loss_reason_value,
            None,
        ]
        sql_values = ", ".join(quote(val) for val in values)
        queries.append(DEAL_TEMPLATE.format(cols=", ".join(deal_columns), vals=sql_values))

        if calculations and calculations != "\N":
            note_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"notes.note:{legacy_id}"))
            note_body = escape(f"Calculations:
{calculations}")
            note_values = ", ".join(
                quote(val)
                for val in [
                    note_id,
                    None,
                    now,
                    now,
                    deal_uuid,
                    note_body,
                    username,
                ]
            )
            queries.append(NOTE_TEMPLATE.format(cols=", ".join(note_columns), vals=note_values))

    return queries


def main() -> None:
    args = parse_args()
    client_map = json.loads(args.client_map.read_text(encoding="utf-8"))
    content = args.dump.read_text(encoding="utf-8")
    rows = extract_rows(content)
    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    queries = build_queries(rows, client_map, args.created_by, now)
    args.output.write_text("
".join(queries), encoding="utf-8")


if __name__ == "__main__":
    main()
