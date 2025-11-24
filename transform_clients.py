import uuid
from datetime import datetime
from pathlib import Path
import json

src = Path("backup_2025-11-24_15-20.sql")
text = src.read_text(encoding="utf-8")
start = text.index("COPY public.client")
end = text.index("\n\\.", start)
block = text[start:end].splitlines()
rows = []
for line in block[1:]:
    if not line.strip():
        continue
    parts = line.split("\t")
    if len(parts) < 9:
        continue
    rows.append(parts[:9])

lines = []
now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")

def clean(value):
    return None if value == "\\N" else value

def escape(value):
    return value.replace("'", "''") if value else None

for cols in rows:
    _, name, phone, email, _, note, drive_path, drive_link, is_deleted = cols
    name = clean(name)
    phone = clean(phone)
    email = clean(email)
    note = clean(note)
    drive_path = clean(drive_path)
    drive_link = clean(drive_link)
    meta = {}
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
    values = [
        f"{uuid.uuid4()}",
        deleted_at,
        now,
        now,
        "(SELECT id FROM auth_user WHERE username = 'Vova' LIMIT 1)",
        escape(name),
        escape(phone),
        escape(notes_value),
        escape(email),
    ]
    sql_values = []
    for idx, val in enumerate(values):
        if idx == 4:
            sql_values.append(val)
        else:
            sql_values.append(f"'{val}'" if val is not None else "NULL")
    if deleted_at is None:
        sql_values[1] = "NULL"
    lines.append(
        "INSERT INTO clients_client (id, deleted_at, created_at, updated_at, created_by_id, name, phone, notes, email) VALUES ("
        + ", ".join(sql_values)
        + ");"
    )

Path("client_import.sql").write_text("\n".join(lines), encoding="utf-8")
