import importlib.util
import sys
import types
from pathlib import Path


SCRIPT_PATH = Path(__file__).with_name("backup_project_to_drive.py")


def _load_backup_script():
    google_module = types.ModuleType("google")
    oauth2_module = types.ModuleType("google.oauth2")
    credentials_module = types.ModuleType("google.oauth2.credentials")
    service_account_module = types.ModuleType("google.oauth2.service_account")
    googleapiclient_module = types.ModuleType("googleapiclient")
    discovery_module = types.ModuleType("googleapiclient.discovery")
    errors_module = types.ModuleType("googleapiclient.errors")
    http_module = types.ModuleType("googleapiclient.http")
    openpyxl_module = types.ModuleType("openpyxl")
    psycopg_module = types.ModuleType("psycopg")
    psycopg_sql_module = types.ModuleType("psycopg.sql")

    discovery_module.build = lambda *args, **kwargs: None
    errors_module.HttpError = Exception
    http_module.MediaFileUpload = object
    openpyxl_module.Workbook = object
    psycopg_sql_module.SQL = object
    psycopg_sql_module.Identifier = object

    stubbed_modules = {
        "google": google_module,
        "google.oauth2": oauth2_module,
        "google.oauth2.credentials": credentials_module,
        "google.oauth2.service_account": service_account_module,
        "googleapiclient": googleapiclient_module,
        "googleapiclient.discovery": discovery_module,
        "googleapiclient.errors": errors_module,
        "googleapiclient.http": http_module,
        "openpyxl": openpyxl_module,
        "psycopg": psycopg_module,
        "psycopg.sql": psycopg_sql_module,
    }

    previous = {name: sys.modules.get(name) for name in stubbed_modules}
    sys.modules.update(stubbed_modules)
    try:
        spec = importlib.util.spec_from_file_location(
            "backup_project_to_drive", SCRIPT_PATH
        )
        module = importlib.util.module_from_spec(spec)
        assert spec and spec.loader
        spec.loader.exec_module(module)
        return module
    finally:
        for name, original in previous.items():
            if original is None:
                sys.modules.pop(name, None)
            else:
                sys.modules[name] = original


def test_oauth_refresh_token_prefers_file_value(tmp_path, monkeypatch):
    backup_script = _load_backup_script()
    token_file = tmp_path / "google_drive_oauth_refresh_token"
    token_file.write_text("fresh-token\n", encoding="utf-8")

    monkeypatch.setenv("GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN", "stale-token")
    monkeypatch.setenv("GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN_FILE", str(token_file))

    assert backup_script._oauth_refresh_token({}) == "fresh-token"


def test_oauth_refresh_token_falls_back_to_env_when_file_missing(monkeypatch):
    backup_script = _load_backup_script()

    monkeypatch.setenv("GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN", "stale-token")
    monkeypatch.setenv(
        "GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN_FILE", "/tmp/non-existent-refresh-token"
    )

    assert backup_script._oauth_refresh_token({}) == "stale-token"


def test_oauth_refresh_token_falls_back_to_env_when_file_empty(tmp_path, monkeypatch):
    backup_script = _load_backup_script()
    token_file = tmp_path / "google_drive_oauth_refresh_token"
    token_file.write_text("\n", encoding="utf-8")

    monkeypatch.setenv("GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN", "stale-token")
    monkeypatch.setenv("GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN_FILE", str(token_file))

    assert backup_script._oauth_refresh_token({}) == "stale-token"
