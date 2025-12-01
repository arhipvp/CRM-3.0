from __future__ import annotations

import argparse
import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Iterable, Sequence

INSERT_TEMPLATE = (
    "INSERT INTO clients_client (id, deleted_at, created_at, updated_at, created_by_id, name, phone, notes, email) "
    "VALUES ({values});"
)

IMPORT_DATA_DIR = Path("import/data")


def parse_args():
    parser = argparse.ArgumentParser(description="Transform backup clients to CRM inserts.")
    parser.add_argument(
        "--dump",
        type=Path,
        default=IMPORT_DATA_DIR / "backup_2025-11-24_15-20.sql",
        help="SQL dump file containing COPY for public.client",
    )
    parser.add_argument(
        "--output-sql",
        type=Path,
        default=IMPORT_DATA_DIR / "client_import.sql",
        help="Target SQL file with INSERTs",
    )
    parser.add_argument(
        "--output-map",
        type=Path,
        default=IMPORT_DATA_DIR / "client_mapping.json",
        help="JSON mapping from legacy IDs to UUIDs",
    )
    parser.add_argument(
        "--created-by",
        default="Vova",
        help="Username to use for created_by_id lookup",
    )
    return parser.parse_args()


def clean(value: str | None) -> str | None:
    if value is None:
        return None
    if value == "\\N":
        return None
    return value


def escape(value: str | None) -> str | None:
    if not value:
        return None
    return value.replace("'", "''")


def iter_client_rows(lines: Sequence[str]) -> Iterable[Sequence[str]]:
    for line in lines:
        if not line.strip():
            continue
        parts = line.split("\t")
        if len(parts) < 9:
            continue
        yield parts[:9]


def build_inserts(
    rows: Iterable[Sequence[str]], user: str, now: str, default_phone: str, default_email: str
) -> tuple[list[str], dict[str, str]]:
    inserts: list[str] = []
    mapping: dict[str, str] = {}
    for cols in rows:
        client_id, name, phone, email, *_ = cols[:5]
        note = cols[5]
        drive_path = cols[6]
        drive_link = cols[7]
        is_deleted = cols[8]
        name = clean(name)
        phone = clean(phone)
        email = clean(email)
        note = clean(note)
        drive_path = clean(drive_path)
        drive_link = clean(drive_link)
        legacy_id = client_id
        meta = {"legacy_client_id": legacy_id}
        if drive_path:
            meta["drive_folder_path"] = drive_path
        if drive_link:
            meta["drive_folder_link"] = drive_link
        notes = []
        if note:
            notes.append(note)
        if meta:
            notes.append(json.dumps(meta, ensure_ascii=False))
        notes_value = "\n".join(notes) if notes else None
        deleted_at = now if is_deleted == "t" else None
        row_uuid = str(uuid.uuid5(uuid.NAMESPACE_URL, f"clients.client:{legacy_id}"))
        mapping[str(legacy_id)] = row_uuid
        values = [
            row_uuid,
            deleted_at,
            now,
            now,
            f"(SELECT id FROM auth_user WHERE username = '{user}' LIMIT 1)",
            escape(name),
            escape(phone) if phone else default_phone,
            escape(notes_value),
            escape(email) if email else default_email,
        ]
        sql_values = []
        for idx, val in enumerate(values):
            if idx == 4:
                sql_values.append(val)
                continue
            sql_values.append(f"'{val}'" if val is not None else "NULL")
        if deleted_at is None:
            sql_values[1] = "NULL"
        inserts.append(INSERT_TEMPLATE.format(values=", ".join(sql_values)))
    return inserts, mapping


def main() -> None:
    args = parse_args()
    content = args.dump.read_text(encoding="utf-8")
    start = content.index("COPY public.client")
    end = content.index("\n\\.", start)
    block = content[start:end].splitlines()[1:]
    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    default_phone = "+7 000 000 00 00"
    default_email = "email@email.email"

    rows = list(iter_client_rows(block))
    inserts, client_map = build_inserts(rows, args.created_by, now, default_phone, default_email)
    args.output_sql.write_text("\n".join(inserts), encoding="utf-8")
    args.output_map.write_text(json.dumps(client_map, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
