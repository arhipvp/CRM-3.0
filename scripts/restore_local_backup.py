"""Restore the local Docker stack from a Google Drive backup snapshot."""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path
from typing import Iterable
from urllib.request import urlopen

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_BACKUP_ROOT = Path(r"G:\Мой диск\CRM 3.0 Backup")
SNAPSHOT_PREFIX = "crm3-backup-"
BACKEND_ENV_CANDIDATES = (
    PROJECT_ROOT / "backend/.env",
    PROJECT_ROOT / "backend/.env.example",
)
DEFAULT_LOCAL_MEDIA_FALLBACK = PROJECT_ROOT / "tmp/local-media"
DEFAULT_LOCAL_BACKUP_STAGE = PROJECT_ROOT / "tmp/local-backup"
HTTP_HEALTH_URL = "http://localhost/health/"


def load_env_file(path: Path) -> Iterable[tuple[str, str]]:
    if not path.exists():
        return

    with path.open("r", encoding="utf-8") as source:
        for raw_line in source:
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            yield key.strip(), value.strip().strip('"').strip("'")


def build_compose_env() -> dict[str, str]:
    compose_env = os.environ.copy()
    for env_file in BACKEND_ENV_CANDIDATES:
        for key, value in load_env_file(env_file):
            compose_env.setdefault(key, value)

    compose_env.setdefault("DJANGO_DB_NAME", "crm3")
    compose_env.setdefault("DJANGO_DB_USER", "crm3")
    compose_env.setdefault("DJANGO_DB_PASSWORD", "crm3")
    return compose_env


def resolve_snapshot(backup_root: Path, snapshot_name: str | None) -> Path:
    if not backup_root.exists():
        raise SystemExit(f"Backup root does not exist: {backup_root}")

    if snapshot_name:
        explicit = Path(snapshot_name)
        if explicit.is_dir():
            return explicit

        candidate = backup_root / snapshot_name
        if candidate.is_dir():
            return candidate

        raise SystemExit(f"Backup snapshot was not found: {snapshot_name}")

    snapshots = sorted(
        item
        for item in backup_root.iterdir()
        if item.is_dir() and item.name.startswith(SNAPSHOT_PREFIX)
    )
    if not snapshots:
        raise SystemExit(
            f"No backup snapshots matching {SNAPSHOT_PREFIX}* in {backup_root}"
        )
    return snapshots[-1]


def resolve_sql_dump(snapshot_dir: Path) -> Path:
    dumps_dir = snapshot_dir / "database-dumps"
    sql_files = sorted(dumps_dir.glob("*.sql"))
    if not sql_files:
        raise SystemExit(f"No SQL dumps found in {dumps_dir}")
    return sql_files[-1]


def prepare_staged_sql_snapshot(
    snapshot_dir: Path, sql_dump: Path
) -> tuple[Path, Path]:
    stage_root = DEFAULT_LOCAL_BACKUP_STAGE
    target_snapshot = stage_root / snapshot_dir.name
    target_dumps = target_snapshot / "database-dumps"

    if target_snapshot.exists():
        shutil.rmtree(target_snapshot)

    target_dumps.mkdir(parents=True, exist_ok=True)
    staged_sql_dump = target_dumps / sql_dump.name
    shutil.copy2(sql_dump, staged_sql_dump)
    return stage_root, staged_sql_dump


def mirror_media_tree(source: Path, target: Path) -> None:
    if os.name == "nt":
        target.mkdir(parents=True, exist_ok=True)
        result = subprocess.run(
            [
                "robocopy",
                str(source),
                str(target),
                "/MIR",
                "/R:2",
                "/W:2",
                "/NFL",
                "/NDL",
                "/NJH",
                "/NJS",
                "/NP",
            ],
            cwd=PROJECT_ROOT,
            check=False,
        )
        if result.returncode > 7:
            raise SystemExit(
                f"robocopy failed while mirroring Media (exit code {result.returncode})."
            )
        return

    if target.exists():
        shutil.rmtree(target)
    shutil.copytree(source, target)


def run(
    command: list[str], *, env: dict[str, str], check: bool = True
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        cwd=PROJECT_ROOT,
        env=env,
        check=check,
        text=True,
    )


def stop_application_services(compose_env: dict[str, str]) -> None:
    run(
        ["docker", "compose", "stop", "backend", "telegram_bot", "frontend", "nginx"],
        env=compose_env,
        check=False,
    )


def ensure_db_service(compose_env: dict[str, str]) -> None:
    run(
        ["docker", "compose", "up", "-d", "--force-recreate", "db"],
        env=compose_env,
    )


def wait_for_db(compose_env: dict[str, str], timeout_seconds: int = 120) -> None:
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        result = run(
            [
                "docker",
                "compose",
                "exec",
                "-T",
                "db",
                "pg_isready",
                "-U",
                compose_env["DJANGO_DB_USER"],
                "-d",
                compose_env["DJANGO_DB_NAME"],
            ],
            env=compose_env,
            check=False,
        )
        if result.returncode == 0:
            return
        time.sleep(2)
    raise SystemExit("Postgres did not become ready in time.")


def reset_database(compose_env: dict[str, str]) -> None:
    db_name = compose_env["DJANGO_DB_NAME"]
    shell_script = (
        'export PGPASSWORD="$POSTGRES_PASSWORD"; '
        'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres '
        f"-c \"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '{db_name}' AND pid <> pg_backend_pid();\" "
        f'-c "DROP DATABASE IF EXISTS \\"{db_name}\\";" '
        f'-c "CREATE DATABASE \\"{db_name}\\";"'
    )
    run(
        ["docker", "compose", "exec", "-T", "db", "sh", "-lc", shell_script],
        env=compose_env,
    )


def restore_sql_dump(
    compose_env: dict[str, str], sql_dump: Path, backup_root: Path
) -> None:
    sql_path_in_container = (
        "/backup/crm3/" + sql_dump.relative_to(backup_root).as_posix()
    )
    shell_script = (
        'export PGPASSWORD="$POSTGRES_PASSWORD"; '
        'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" '
        f'-f "{sql_path_in_container}"'
    )
    run(
        ["docker", "compose", "exec", "-T", "db", "sh", "-lc", shell_script],
        env=compose_env,
    )


def start_full_stack(compose_env: dict[str, str]) -> None:
    run(
        [
            "docker",
            "compose",
            "up",
            "-d",
            "--force-recreate",
            "backend",
            "telegram_bot",
            "frontend",
            "nginx",
        ],
        env=compose_env,
    )


def wait_for_http_health(timeout_seconds: int = 180) -> None:
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        try:
            with urlopen(HTTP_HEALTH_URL, timeout=5) as response:
                if response.status == 200:
                    return
        except Exception:
            pass
        time.sleep(3)
    raise SystemExit(f"HTTP health endpoint did not become ready: {HTTP_HEALTH_URL}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Restore the local Docker stack from a backup snapshot."
    )
    parser.add_argument(
        "--backup-root",
        default=str(DEFAULT_BACKUP_ROOT),
        help="Path to the backup root containing crm3-backup-* snapshots.",
    )
    parser.add_argument(
        "--snapshot",
        help="Snapshot directory name or absolute path. Defaults to the latest crm3-backup-*.",
    )
    parser.add_argument(
        "--skip-media",
        action="store_true",
        help="Do not mount the shared backup Media folder into the local stack.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    backup_root = Path(args.backup_root).expanduser()
    snapshot_dir = resolve_snapshot(backup_root, args.snapshot)
    sql_dump = resolve_sql_dump(snapshot_dir)
    media_path = backup_root / "Media"
    staged_backup_root, staged_sql_dump = prepare_staged_sql_snapshot(
        snapshot_dir, sql_dump
    )

    compose_env = build_compose_env()
    compose_env["LOCAL_BACKUP_ROOT"] = str(staged_backup_root)
    if args.skip_media:
        DEFAULT_LOCAL_MEDIA_FALLBACK.mkdir(parents=True, exist_ok=True)
        compose_env["LOCAL_BACKUP_MEDIA_PATH"] = str(DEFAULT_LOCAL_MEDIA_FALLBACK)
    else:
        if not media_path.exists():
            raise SystemExit(f"Backup Media directory does not exist: {media_path}")
        DEFAULT_LOCAL_MEDIA_FALLBACK.mkdir(parents=True, exist_ok=True)
        compose_env["LOCAL_BACKUP_MEDIA_PATH"] = str(DEFAULT_LOCAL_MEDIA_FALLBACK)

    print(f"Using snapshot: {snapshot_dir}")
    print(f"Using SQL dump: {sql_dump}")
    print(f"Staged SQL dump: {staged_sql_dump}")
    print(f"Media mount: {compose_env['LOCAL_BACKUP_MEDIA_PATH']}")

    stop_application_services(compose_env)
    ensure_db_service(compose_env)
    wait_for_db(compose_env)
    reset_database(compose_env)
    restore_sql_dump(compose_env, staged_sql_dump, staged_backup_root)
    start_full_stack(compose_env)
    wait_for_http_health()
    if not args.skip_media:
        print("Mirroring Media into local staging...")
        mirror_media_tree(media_path, DEFAULT_LOCAL_MEDIA_FALLBACK)

    print("Local backup restore completed successfully.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
