import importlib.util
from pathlib import Path

import pytest

SCRIPT_PATH = Path(__file__).with_name("restore_local_backup.py")


def _load_restore_script():
    spec = importlib.util.spec_from_file_location("restore_local_backup", SCRIPT_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


def test_resolve_snapshot_uses_latest_named_backup(tmp_path):
    restore_script = _load_restore_script()
    (tmp_path / "crm3-backup-20260417-220301").mkdir()
    latest = tmp_path / "crm3-backup-20260418-220018"
    latest.mkdir()
    (tmp_path / "Media").mkdir()

    resolved = restore_script.resolve_snapshot(tmp_path, None)

    assert resolved == latest


def test_resolve_snapshot_accepts_explicit_directory_name(tmp_path):
    restore_script = _load_restore_script()
    expected = tmp_path / "crm3-backup-20260418-220018"
    expected.mkdir()

    resolved = restore_script.resolve_snapshot(tmp_path, expected.name)

    assert resolved == expected


def test_resolve_sql_dump_returns_single_sql_file(tmp_path):
    restore_script = _load_restore_script()
    snapshot = tmp_path / "crm3-backup-20260418-220018"
    dumps = snapshot / "database-dumps"
    dumps.mkdir(parents=True)
    sql_path = dumps / "crm3-db-20260418-220018.sql"
    sql_path.write_text("-- dump", encoding="utf-8")

    resolved = restore_script.resolve_sql_dump(snapshot)

    assert resolved == sql_path


def test_resolve_sql_dump_fails_without_sql_files(tmp_path):
    restore_script = _load_restore_script()
    snapshot = tmp_path / "crm3-backup-20260418-220018"
    (snapshot / "database-dumps").mkdir(parents=True)

    with pytest.raises(SystemExit, match="No SQL dumps found"):
        restore_script.resolve_sql_dump(snapshot)
