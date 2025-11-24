import json
import uuid
from datetime import datetime
from pathlib import Path

client_map = json.loads(Path("client_mapping.json").read_text(encoding="utf-8"))

text = Path("backup_2025-11-24_15-20.sql").read_text(encoding="utf-8")
start = text.index("COPY public.deal")
end = text.index("\n\\.", start)
block = text[start:end].splitlines()
rows = []
for line in block[1:]:
    if not line.strip():
        continue
    parts = line.split("\t")
    if len(parts) < 12:
        continue
    rows.append(parts[:12])

now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")

def clean(value):
    return None if value == "\\N" else value

def prepare_string(value):
    if value is None:
        return None
    safe = value.replace("'", "''")
    return safe.replace("\n", "\\n")

def quote(value):
    if value is None:
        return "NULL"
    return f"'{value}'"

lines = []
for cols in rows:
    _, client_id, start_date, status, description, calculations, reminder_date, is_closed, closed_reason, drive_path, drive_link, is_deleted = cols
    client_uuid = client_map.get(client_id)
    if not client_uuid:
        continue
    title = description.strip() if description else f"Deal #{client_id}"
    description_parts = [description] if description else []
    if calculations and calculations != "\\N":
        description_parts.append(f"Calculations:\n{calculations}")
    drive_meta = {}
    if drive_path and drive_path != "\\N":
        drive_meta["drive_folder_path"] = drive_path
    if drive_link and drive_link != "\\N":
        drive_meta["drive_folder_link"] = drive_link
    if drive_meta:
        description_parts.append(json.dumps(drive_meta, ensure_ascii=False))
    full_description = "\n\n".join(part for part in description_parts if part)
    next_contact_date = reminder_date if reminder_date and reminder_date != "\\N" else start_date
    status_value = status if status and status != "\\N" else "open"
    loss_reason = closed_reason if closed_reason and closed_reason != "\\N" else None
    if is_closed == "t":
        status_value = "closed"
        if not loss_reason:
            loss_reason = "Closed in import"
    deleted_at = now if is_deleted == "t" else None
    deal_uuid = str(uuid.uuid4())
    title_value = prepare_string(title)
    desc_value = prepare_string(full_description)
    status_value = prepare_string(status_value)
    loss_reason_value = prepare_string(loss_reason)
    next_contact = next_contact_date if next_contact_date and next_contact_date != "\\N" else None
    values = [
        deal_uuid,
        deleted_at,
        now,
        now,
        title_value,
        desc_value,
        client_uuid,
        None,
        None,
        status_value if status_value else "open",
        "",
        None,
        next_contact,
        None,
        None,
        loss_reason_value,
        None,
    ]
    columns = [
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
    sql_values = []
    for idx, val in enumerate(values):
        sql_values.append(quote(val))
    lines.append(
        "INSERT INTO deals_deal ("
        + ", ".join(columns)
        + ") VALUES ("
        + ", ".join(sql_values)
        + ");"
    )

Path("deal_import.sql").write_text("\n".join(lines), encoding="utf-8")
