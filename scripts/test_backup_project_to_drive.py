import importlib.util
import sys
import types
from pathlib import Path


SCRIPT_PATH = Path(__file__).with_name("backup_project_to_drive.py")


def _load_backup_script():
    google_module = types.ModuleType("google")
    oauth2_module = types.ModuleType("google.oauth2")
    credentials_module = types.ModuleType("google.oauth2.credentials")
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


def test_drive_backup_requires_oauth_credentials(monkeypatch):
    backup_script = _load_backup_script()

    monkeypatch.delenv("GOOGLE_DRIVE_OAUTH_CLIENT_ID", raising=False)
    monkeypatch.delenv("GOOGLE_DRIVE_OAUTH_CLIENT_SECRET", raising=False)
    monkeypatch.delenv("GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN", raising=False)
    monkeypatch.delenv("GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN_FILE", raising=False)

    try:
        backup_script.DriveBackup({})
    except SystemExit as exc:
        assert "Google Drive OAuth credentials are not configured" in str(exc)
    else:
        raise AssertionError("DriveBackup must fail without OAuth credentials")


def test_drive_backup_builds_oauth_service(monkeypatch):
    backup_script = _load_backup_script()

    captured: dict[str, object] = {}

    class DummyCredentials:
        def __init__(self, **kwargs):
            captured["credentials_kwargs"] = kwargs

    def fake_build(api_name, version, credentials=None, cache_discovery=None):
        captured["build_args"] = {
            "api_name": api_name,
            "version": version,
            "credentials": credentials,
            "cache_discovery": cache_discovery,
        }
        return "drive-service"

    monkeypatch.setattr(
        backup_script.oauth_credentials,
        "Credentials",
        DummyCredentials,
        raising=False,
    )
    monkeypatch.setattr(backup_script, "build", fake_build)
    monkeypatch.setenv("GOOGLE_DRIVE_OAUTH_CLIENT_ID", "oauth-client-id")
    monkeypatch.setenv("GOOGLE_DRIVE_OAUTH_CLIENT_SECRET", "oauth-client-secret-value")
    monkeypatch.setenv("GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN", "oauth-refresh-token-value")

    drive_backup = backup_script.DriveBackup({})

    assert drive_backup.services == [("oauth", "drive-service")]
    assert captured["credentials_kwargs"] == {
        "token": None,
        "refresh_token": "oauth-refresh-token-value",  # pragma: allowlist secret
        "token_uri": backup_script.DEFAULT_GOOGLE_OAUTH_TOKEN_URI,
        "client_id": "oauth-client-id",
        "client_secret": "oauth-client-secret-value",  # pragma: allowlist secret
        "scopes": backup_script.DRIVE_SCOPES,
    }
    assert captured["build_args"]["api_name"] == "drive"
    assert captured["build_args"]["version"] == "v3"
    assert captured["build_args"]["cache_discovery"] is False
