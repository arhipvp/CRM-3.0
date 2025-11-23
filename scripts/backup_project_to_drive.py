"""Backup the CRM repository and its Drive files into a dedicated Google Drive folder."""

from __future__ import annotations

import argparse
import logging
import os
import shutil
import socket
import subprocess
import tempfile
import zipfile
from datetime import date, datetime, time, timezone
from pathlib import Path
from typing import Iterator, Optional
from urllib.parse import quote_plus

from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaFileUpload
from google.oauth2 import service_account
from openpyxl import Workbook
import psycopg
from psycopg.sql import Identifier, SQL

DRIVE_SCOPES = ("https://www.googleapis.com/auth/drive",)
FOLDER_MIME_TYPE = "application/vnd.google-apps.folder"

ROOT_ENV_FILES = (".env", "backend/.env")
EXCLUDE_DIRS = {
    ".git",
    ".venv",
    "venv",
    "__pycache__",
    "node_modules",
    "frontend/node_modules",
    "frontend/.vite",
    "frontend/dist",
    "backend/.venv",
    "backend/static",
    "backend/media",
    ".claude",
}

logger = logging.getLogger(__name__)


def load_env_file(env_path: Path) -> Iterator[tuple[str, str]]:
    """Yield environment lines from an .env-style file."""

    if not env_path.exists():
        return

    with env_path.open("r", encoding="utf-8") as source:
        for raw_line in source:
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            yield key.strip(), value.strip().strip('"').strip("'")


def load_environment() -> dict[str, str]:
    """Load configuration values from known env files (without overriding existing vars)."""

    env = {}
    for candidate in ROOT_ENV_FILES:
        path = Path(candidate)
        for key, value in load_env_file(path):
            if key not in env:
                env[key] = value
    return env


def ensure_required_var(env: dict[str, str], name: str) -> str:
    value = os.environ.get(name) or env.get(name)
    if not value:
        raise SystemExit(f"{name} must be set either in the environment or in one of {ROOT_ENV_FILES}")
    return value


def should_exclude(path: Path, root: Path) -> bool:
    """Decide whether a path belongs to the exclusion set."""

    relative = path.relative_to(root)
    parts = relative.parts
    return any(part in EXCLUDE_DIRS for part in parts)


def iter_files(root: Path) -> Iterator[Path]:
    """Yield files under the root excluding ignorable directories."""

    for item in root.rglob("*"):
        try:
            if item.is_dir():
                continue
        except OSError:
            logger.warning("Skipping %s because it cannot be accessed", item)
            continue
        if should_exclude(item, root):
            continue
        yield item


def create_archive(root: Path, destination: Path) -> Path:
    """Create a zip archive of the repository in the given destination path."""

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    name = f"crm3-repo-{timestamp}.zip"
    archive_path = destination / name
    logger.info("Creating project archive %s", archive_path.name)

    file_count = 0
    with zipfile.ZipFile(archive_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for file_path in iter_files(root):
            archive_name = file_path.relative_to(root)
            archive.write(file_path, archive_name)
            file_count += 1

    logger.info("Archive %s contains %d files", archive_path.name, file_count)
    return archive_path


def _sanitize_sheet_name(name: str) -> str:
    """Drive sheet names must be <=31 characters and avoid invalid symbols."""

    cleaned = "".join(ch if ch not in ('[', ']', '*', ':', '?', '/', "\\") else "_" for ch in name)
    trimmed = cleaned.strip()
    if not trimmed:
        return "sheet"
    return trimmed[:31]


def _normalize_cell_value(value):
    if value is None:
        return None
    if isinstance(value, (int, float, bool, str, datetime, date, time)):
        return value
    return str(value)


def _resolve_host(host: str, fallback: Optional[str]) -> str:
    """Try to resolve host; if it fails, fall back to supplied alternative."""

    try:
        socket.gethostbyname(host)
        return host
    except OSError:
        if fallback:
            logger.warning("%s cannot be resolved, falling back to %s", host, fallback)
            return fallback
        logger.warning("%s cannot be resolved; using localhost", host)
        return "localhost"


def build_db_config(env: dict[str, str]) -> dict[str, str]:
    """Gather Postgres credentials from the environment."""

    host = ensure_required_var(env, "DJANGO_DB_HOST")
    fallback_host = os.environ.get("BACKUP_DB_FALLBACK_HOST") or env.get("BACKUP_DB_FALLBACK_HOST")
    resolved_host = _resolve_host(host, fallback_host)

    return {
        "host": resolved_host,
        "port": ensure_required_var(env, "DJANGO_DB_PORT"),
        "name": ensure_required_var(env, "DJANGO_DB_NAME"),
        "user": ensure_required_var(env, "DJANGO_DB_USER"),
        "password": ensure_required_var(env, "DJANGO_DB_PASSWORD"),
    }


def locate_pg_dump() -> Optional[str]:
    """Return the path to `pg_dump` if it exists."""

    path = shutil.which("pg_dump")
    if not path:
        logger.warning("`pg_dump` was not found; SQL dump will be skipped.")
    return path


def _build_db_dsn(config: dict[str, str]) -> str:
    return (
        f"postgresql://{quote_plus(config['user'])}:{quote_plus(config['password'])}"
        f"@{config['host']}:{config['port']}/{config['name']}"
    )


def dump_database(
    config: dict[str, str],
    destination: Path,
    label: str,
    pg_dump_path: Optional[str],
) -> Optional[Path]:
    """Run pg_dump and store a plain SQL file."""

    if not pg_dump_path:
        return None

    filename = destination / f"crm3-db-{label}.sql"
    cmd = [
        pg_dump_path,
        "-h",
        config["host"],
        "-p",
        config["port"],
        "-U",
        config["user"],
        "-d",
        config["name"],
        "-f",
        str(filename),
    ]
    env = os.environ.copy()
    env["PGPASSWORD"] = config["password"]
    logger.info("Dumping Postgres database to %s", filename.name)
    result = subprocess.run(cmd, env=env, capture_output=True, text=True)
    if result.returncode:
        logger.error("pg_dump failed: %s", result.stderr.strip())
        logger.warning("SQL dump could not be created due to pg_dump failure.")
        return None
    return filename


def export_database_to_excel(
    config: dict[str, str],
    destination: Path,
    label: str,
) -> Optional[Path]:
    """Export every public table into separate sheets of one workbook."""

    excel_path = destination / f"crm3-db-{label}.xlsx"
    logger.info("Exporting database tables to Excel %s", excel_path.name)

    query_tables = """
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
    """

    try:
        with psycopg.connect(_build_db_dsn(config)) as conn:
            with conn.cursor() as cursor:
                cursor.execute(query_tables)
                tables = [row[0] for row in cursor.fetchall()]

            workbook = Workbook()
            workbook_sheet_index = 0
            used_sheet_names: set[str] = set()

            for table in tables:
                sanitized = _sanitize_sheet_name(table)
                sheet_name = sanitized
                suffix = 1
                while sheet_name in used_sheet_names:
                    suffix_str = f"_{suffix}"
                    limit = max(0, 31 - len(suffix_str))
                    sheet_name = f"{sanitized[:limit]}{suffix_str}"
                    suffix += 1
                used_sheet_names.add(sheet_name)
                if workbook_sheet_index == 0:
                    sheet = workbook.active
                    sheet.title = sheet_name
                else:
                    sheet = workbook.create_sheet(title=sheet_name)

                with conn.cursor() as cursor:
                    cursor.execute(SQL("SELECT * FROM {}").format(Identifier(table)))
                    columns = [desc.name for desc in cursor.description or []]
                    if columns:
                        sheet.append(columns)
                        for row in cursor:
                            normalized = [_normalize_cell_value(value) for value in row]
                            sheet.append(normalized)

                workbook_sheet_index += 1

            if workbook_sheet_index == 0:
                workbook.active.title = "empty"

            workbook.save(excel_path)
    except Exception as exc:
        logger.exception("Failed to export tables to Excel")
        logger.warning("Excel export could not be created; proceeding without it.")
        return None

    return excel_path


class DriveBackup:
    """Helper for uploading files and copying folders into the backup tree."""

    def __init__(self, credentials_file: Path):
        self.service = build(
            "drive",
            "v3",
            credentials=service_account.Credentials.from_service_account_file(
                credentials_file, scopes=DRIVE_SCOPES
            ),
            cache_discovery=False,
        )

    def create_folder(self, name: str, parent_id: str) -> str:
        logger.debug("Creating Drive folder %s under %s", name, parent_id)
        metadata = {
            "name": name,
            "mimeType": FOLDER_MIME_TYPE,
            "parents": [parent_id],
        }
        response = self.service.files().create(
            body=metadata,
            fields="id",
            supportsAllDrives=True,
        ).execute()
        return response["id"]

    def ensure_folder(self, name: str, parent_id: str) -> str:
        logger.debug("Looking for folder %s under %s", name, parent_id)
        escaped_name = name.replace("'", "\\'")
        query = " and ".join(
            (
                f"name = '{escaped_name}'",
                f"'{parent_id}' in parents",
                f"mimeType = '{FOLDER_MIME_TYPE}'",
                "trashed = false",
            )
        )
        response = (
            self.service.files()
            .list(
                q=query,
                spaces="drive",
                fields="files(id, name)",
                pageSize=1,
                supportsAllDrives=True,
            )
            .execute()
        )
        files = response.get("files") or []
        if files:
            return files[0]["id"]
        return self.create_folder(name, parent_id)

    def upload_file(self, path: Path, parent_id: str) -> str:
        logger.info("Uploading %s to Drive", path.name)
        request = self.service.files().create(
            body={"name": path.name, "parents": [parent_id]},
            media_body=MediaFileUpload(str(path), resumable=True),
            fields="id",
            supportsAllDrives=True,
        )

        response = None
        while response is None:
            status, response = request.next_chunk()

        return response["id"]

    def list_children(self, folder_id: str) -> list[dict]:
        items: list[dict] = []
        page_token: str | None = None
        while True:
            response = (
                self.service.files()
                .list(
                    q=f"'{folder_id}' in parents and trashed = false",
                    spaces="drive",
                    fields="nextPageToken, files(id, name, mimeType)",
                    pageToken=page_token,
                    supportsAllDrives=True,
                    pageSize=200,
                )
                .execute()
            )

            items.extend(response.get("files", []))
            page_token = response.get("nextPageToken")
            if not page_token:
                break

        return items

    def copy_file(self, source_id: str, name: str, parent_id: str) -> str:
        logger.debug("Copying Drive file %s into %s", source_id, parent_id)
        response = (
            self.service.files()
            .copy(
                fileId=source_id,
                body={"name": name, "parents": [parent_id]},
                supportsAllDrives=True,
            )
            .execute()
        )
        return response["id"]

    def copy_folder_tree(self, source_folder_id: str, destination_folder_id: str) -> None:
        children = self.list_children(source_folder_id)
        logger.info("Copying %d Drive items from %s", len(children), source_folder_id)
        for child in children:
            name = child["name"]
            if child["mimeType"] == FOLDER_MIME_TYPE:
                new_folder_id = self.create_folder(name, destination_folder_id)
                self.copy_folder_tree(child["id"], new_folder_id)
            else:
                try:
                    self.copy_file(child["id"], name, destination_folder_id)
                except HttpError as exc:
                    logger.warning("Failed to copy %s (%s): %s", name, child["id"], exc)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Backup CRM sources and Drive files.")
    parser.add_argument(
        "--project-root",
        type=Path,
        default=Path(__file__).resolve().parent.parent,
        help="Path to the CRM root directory",
    )
    parser.add_argument(
        "--env-file",
        type=Path,
        default=None,
        help="Optional path to an extra env file that augments the built-in ones",
    )
    return parser


def main() -> None:
    args = build_parser().parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    env = load_environment()
    if args.env_file:
        env.update({key: value for key, value in load_env_file(args.env_file)})

    service_account_path = Path(ensure_required_var(env, "GOOGLE_DRIVE_SERVICE_ACCOUNT_FILE")).expanduser()
    backup_root = ensure_required_var(env, "GOOGLE_DRIVE_BACKUP_FOLDER_ID")
    drive_root = os.environ.get("GOOGLE_DRIVE_ROOT_FOLDER_ID") or env.get("GOOGLE_DRIVE_ROOT_FOLDER_ID")
    db_config = build_db_config(env)

    timestamp_label = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")

    if not service_account_path.exists():
        raise SystemExit(f"Service account file {service_account_path} does not exist.")

    backup_target_name = f"crm3-backup-{timestamp_label}"
    backup_client = DriveBackup(service_account_path)
    session_folder_id = backup_client.create_folder(backup_target_name, backup_root)
    repo_subfolder_id = backup_client.create_folder("project-repo", session_folder_id)

    db_folder_id = backup_client.create_folder("database-dumps", session_folder_id)

    pg_dump_path = locate_pg_dump()
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_dir_path = Path(temp_dir)
        archive = create_archive(args.project_root, temp_dir_path)
        sql_dump = dump_database(db_config, temp_dir_path, timestamp_label, pg_dump_path)
        excel_dump = export_database_to_excel(db_config, temp_dir_path, timestamp_label)

        backup_client.upload_file(archive, repo_subfolder_id)
        if sql_dump:
            backup_client.upload_file(sql_dump, db_folder_id)
        if excel_dump:
            backup_client.upload_file(excel_dump, db_folder_id)

    if drive_root:
        media_root_id = backup_client.ensure_folder("Media", backup_root)
        media_session_id = backup_client.create_folder(f"drive-mirror-{timestamp_label}", media_root_id)
        backup_client.copy_folder_tree(drive_root, media_session_id)
    else:
        logger.warning("GOOGLE_DRIVE_ROOT_FOLDER_ID is not configured; skipping Drive files backup.")

    logger.info("Backup session %s completed", backup_target_name)


if __name__ == "__main__":
    main()
