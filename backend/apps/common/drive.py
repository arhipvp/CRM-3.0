"""Utilities to manage Google Drive folders used by the CRM."""

from __future__ import annotations

import json
import logging
from io import BytesIO
from pathlib import Path
from typing import Any, BinaryIO, Callable, NotRequired, Optional, TypedDict, TypeVar

from django.conf import settings
from django.db import models
from django.utils import timezone

logger = logging.getLogger(__name__)

try:
    from google.auth import exceptions as _google_auth_exceptions
    from google.oauth2 import credentials as _oauth_credentials
    from googleapiclient.discovery import build as _gdrive_build
    from googleapiclient.errors import HttpError as _GDriveHttpError
    from googleapiclient.http import MediaIoBaseDownload as _MediaIoBaseDownload
    from googleapiclient.http import MediaIoBaseUpload as _MediaIoBaseUpload
except ImportError as exc:  # pragma: no cover - requires optional dependency
    _google_auth_exceptions = None
    _oauth_credentials = None
    _gdrive_build = None
    _GDriveHttpError = None
    _MediaIoBaseUpload = None
    _MediaIoBaseDownload = None
    _drive_import_error = exc
else:
    _drive_import_error = None

DRIVE_SCOPES = ("https://www.googleapis.com/auth/drive",)
FOLDER_MIME_TYPE = "application/vnd.google-apps.folder"
TRASH_FOLDER_NAME = "Корзина"
STATEMENTS_ROOT_FOLDER_NAME = "Ведомости"
DEFAULT_GOOGLE_OAUTH_TOKEN_URI = "https://oauth2.googleapis.com/token"
DRIVE_AUTH_MODE_OAUTH = "oauth"

_T = TypeVar("_T")


class DriveError(Exception):
    """Base class for Drive integration problems."""


class DriveConfigurationError(DriveError):
    """Raised when a configuration value is missing or invalid."""


class DriveOperationError(DriveError):
    """Raised when a Drive API call fails."""


class DriveFileInfo(TypedDict):
    """The subset of Drive file metadata used by the UI."""

    id: str
    name: str
    mime_type: str
    size: Optional[int]
    created_at: Optional[str]
    modified_at: Optional[str]
    web_view_link: Optional[str]
    is_folder: bool
    parent_id: NotRequired[Optional[str]]


class DriveFolderMoveVerification(TypedDict):
    source_before_count: int
    source_after_count: int
    target_before_count: int
    target_after_count: int


class DriveFolderDeleteAttempt(TypedDict):
    deleted: bool
    error: str


class DriveConnectionStatus(TypedDict):
    status: str
    auth_mode: str
    using_fallback: bool
    reconnect_available: bool
    last_checked_at: str
    last_error_code: str
    last_error_message: str
    active_auth_type: str


def _ensure_drive_dependencies() -> None:
    if _drive_import_error:
        raise DriveConfigurationError(
            "google-api-python-client and google-auth must be installed to work with Drive."
        )

    if not _gdrive_build:
        raise DriveConfigurationError("Drive client dependencies are not available.")


def _get_oauth_settings() -> dict[str, str]:
    refresh_token = getattr(settings, "GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN", "").strip()
    refresh_token_file = str(
        getattr(settings, "GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN_FILE", "") or ""
    ).strip()
    if refresh_token_file:
        path = Path(refresh_token_file)
        if path.exists():
            file_token = path.read_text(encoding="utf-8").strip()
            if file_token:
                refresh_token = file_token
    return {
        "client_id": getattr(settings, "GOOGLE_DRIVE_OAUTH_CLIENT_ID", "").strip(),
        "client_secret": getattr(
            settings, "GOOGLE_DRIVE_OAUTH_CLIENT_SECRET", ""
        ).strip(),
        "refresh_token": refresh_token,
        "token_uri": (
            getattr(settings, "GOOGLE_DRIVE_OAUTH_TOKEN_URI", "")
            or DEFAULT_GOOGLE_OAUTH_TOKEN_URI
        ).strip(),
    }


def is_drive_oauth_configured(*, require_root_folder: bool = True) -> bool:
    """Return whether Drive OAuth settings are complete enough for Drive operations."""

    oauth_settings = _get_oauth_settings()
    has_oauth = all(
        [
            oauth_settings["client_id"],
            oauth_settings["client_secret"],
            oauth_settings["refresh_token"],
        ]
    )
    if not has_oauth:
        return False
    if require_root_folder:
        root_folder_id = getattr(settings, "GOOGLE_DRIVE_ROOT_FOLDER_ID", "").strip()
        if not root_folder_id:
            return False
    return True


def _build_drive_client(credentials: Any, *, auth_type: str):
    if not _gdrive_build:
        raise DriveConfigurationError("Drive client dependencies are not available.")
    try:
        return _gdrive_build(
            "drive", "v3", credentials=credentials, cache_discovery=False
        )
    except Exception as exc:  # pragma: no cover - relies on third-party errors
        raise DriveConfigurationError(
            f"Unable to initialize Google Drive client with {auth_type}."
        ) from exc


def _build_oauth_drive_service():
    oauth_settings = _get_oauth_settings()
    has_any = any(
        [
            oauth_settings["client_id"],
            oauth_settings["client_secret"],
            oauth_settings["refresh_token"],
        ]
    )
    has_all = all(
        [
            oauth_settings["client_id"],
            oauth_settings["client_secret"],
            oauth_settings["refresh_token"],
        ]
    )
    if not has_any:
        return None
    if not has_all:
        raise DriveConfigurationError(
            "Google Drive OAuth settings are partially configured."
        )
    if not _oauth_credentials:
        raise DriveConfigurationError(
            "google-auth OAuth credentials support is not available."
        )
    credentials = _oauth_credentials.Credentials(
        token=None,
        refresh_token=oauth_settings["refresh_token"],
        token_uri=oauth_settings["token_uri"] or DEFAULT_GOOGLE_OAUTH_TOKEN_URI,
        client_id=oauth_settings["client_id"],
        client_secret=oauth_settings["client_secret"],
        scopes=DRIVE_SCOPES,
    )
    return _build_drive_client(credentials, auth_type=DRIVE_AUTH_MODE_OAUTH)


def _extract_http_error_status_reason(exc: Exception) -> tuple[Optional[int], str]:
    if not _GDriveHttpError or not isinstance(exc, _GDriveHttpError):
        return None, ""
    response = getattr(exc, "resp", None)
    status = getattr(response, "status", None) if response is not None else None
    reason = ""

    raw_content = getattr(exc, "content", b"")
    if isinstance(raw_content, bytes):
        raw_content = raw_content.decode("utf-8", errors="ignore")
    if isinstance(raw_content, str) and raw_content:
        try:
            payload = json.loads(raw_content)
        except (TypeError, ValueError, json.JSONDecodeError):
            payload = {}
        error_data = payload.get("error", {}) if isinstance(payload, dict) else {}
        if isinstance(error_data, dict):
            errors = error_data.get("errors")
            if isinstance(errors, list):
                for entry in errors:
                    if not isinstance(entry, dict):
                        continue
                    entry_reason = str(entry.get("reason", "")).strip()
                    if entry_reason:
                        reason = entry_reason
                        break
            if not reason:
                reason = (
                    str(error_data.get("status", "")).strip()
                    or str(error_data.get("message", "")).strip()
                )
    return status, reason


def _is_refresh_error(exc: Exception) -> bool:
    refresh_error_cls = (
        getattr(_google_auth_exceptions, "RefreshError", None)
        if _google_auth_exceptions
        else None
    )
    return bool(refresh_error_cls and isinstance(exc, refresh_error_cls))


def _extract_refresh_error_details(exc: Exception) -> tuple[str, str]:
    raw_message = " ".join(
        str(part) for part in getattr(exc, "args", ()) if part
    ).strip()
    if not raw_message:
        raw_message = str(exc).strip()
    normalized = raw_message.lower()
    if "invalid_grant" in normalized and (
        "expired" in normalized or "revoked" in normalized
    ):
        return "oauth_refresh_revoked", raw_message
    if "invalid_grant" in normalized:
        return "oauth_invalid_grant", raw_message
    if "invalid_client" in normalized:
        return "oauth_invalid_client", raw_message
    return "oauth_refresh_error", raw_message or "OAuth refresh failed."


def _extract_drive_error_details(exc: Exception) -> tuple[Optional[int], str, str]:
    if _is_refresh_error(exc):
        code, message = _extract_refresh_error_details(exc)
        return None, code, message

    status, reason = _extract_http_error_status_reason(exc)
    if status is not None:
        code = reason or f"http_{status}"
        return status, code, reason or f"HTTP {status}"

    return (
        None,
        exc.__class__.__name__.lower(),
        str(exc).strip() or exc.__class__.__name__,
    )


def _log_drive_api_failure(operation: str, auth_type: str, exc: Exception) -> None:
    status, code, message = _extract_drive_error_details(exc)
    if status is None:
        logger.error(
            "Google Drive operation failed. operation=%s auth=%s code=%s message=%s",
            operation,
            auth_type,
            code or "unknown",
            message or "unknown",
            exc_info=True,
        )
        return

    logger.error(
        "Google Drive API error. operation=%s auth=%s status=%s code=%s reason=%s",
        operation,
        auth_type,
        status,
        code or "unknown",
        message or "unknown",
        exc_info=True,
    )
    if status in (401, 403):
        logger.error(
            "Google Drive alert. operation=%s auth=%s status=%s code=%s reason=%s",
            operation,
            auth_type,
            status,
            code or "unknown",
            message or "unknown",
        )


def _get_drive_services() -> list[tuple[str, Any]]:
    _ensure_drive_dependencies()
    oauth_service = _build_oauth_drive_service()
    if not oauth_service:
        raise DriveConfigurationError(
            "Google Drive OAuth credentials are not configured."
        )
    return [(DRIVE_AUTH_MODE_OAUTH, oauth_service)]


def _run_with_drive_service(
    operation: str,
    action: Callable[[Any], _T],
    *,
    return_none_on_statuses: tuple[int, ...] = (),
    diagnostics: Optional[dict[str, Any]] = None,
) -> Optional[_T]:
    services = _get_drive_services()
    auth_type, service = services[0]
    if diagnostics is not None:
        diagnostics.setdefault("attempts", []).append(auth_type)
    try:
        result = action(service)
        if diagnostics is not None:
            diagnostics["active_auth_type"] = auth_type
            diagnostics["using_fallback"] = False
            diagnostics.setdefault("last_error_code", "")
            diagnostics.setdefault("last_error_message", "")
        return result
    except Exception as exc:
        status, code, message = _extract_drive_error_details(exc)
        _log_drive_api_failure(operation, auth_type, exc)
        if diagnostics is not None:
            diagnostics["last_error_code"] = code or ""
            diagnostics["last_error_message"] = message or ""
        if status in return_none_on_statuses:
            return None
        raise


def get_drive_connection_status() -> DriveConnectionStatus:
    root_folder_id = getattr(settings, "GOOGLE_DRIVE_ROOT_FOLDER_ID", "").strip()
    timestamp = timezone.now().isoformat()
    reconnect_available = bool(
        getattr(settings, "GOOGLE_DRIVE_OAUTH_CLIENT_ID", "").strip()
        and getattr(settings, "GOOGLE_DRIVE_OAUTH_CLIENT_SECRET", "").strip()
        and getattr(settings, "GOOGLE_DRIVE_OAUTH_REDIRECT_URI", "").strip()
        and root_folder_id
    )

    base_status: DriveConnectionStatus = {
        "status": "error",
        "auth_mode": DRIVE_AUTH_MODE_OAUTH,
        "using_fallback": False,
        "reconnect_available": reconnect_available,
        "last_checked_at": timestamp,
        "last_error_code": "",
        "last_error_message": "",
        "active_auth_type": "",
    }

    if not root_folder_id:
        base_status["status"] = "not_configured"
        base_status["last_error_code"] = "missing_root_folder_id"
        base_status["last_error_message"] = (
            "GOOGLE_DRIVE_ROOT_FOLDER_ID is not configured."
        )
        return base_status

    diagnostics: dict[str, Any] = {}
    try:
        _run_with_drive_service(
            "probe_drive_connection",
            lambda service: service.files()
            .get(
                fileId=root_folder_id,
                fields="id,name",
                supportsAllDrives=True,
            )
            .execute(),
            diagnostics=diagnostics,
        )
    except DriveConfigurationError as exc:
        base_status["status"] = "error"
        base_status["last_error_code"] = "drive_config_error"
        base_status["last_error_message"] = str(exc)
        return base_status
    except Exception as exc:
        _, code, message = _extract_drive_error_details(exc)
        base_status["status"] = (
            "needs_reconnect"
            if code.startswith("oauth_") and "refresh" in code
            else "error"
        )
        base_status["last_error_code"] = code
        base_status["last_error_message"] = message
        return base_status

    base_status["active_auth_type"] = str(diagnostics.get("active_auth_type") or "")
    base_status["using_fallback"] = bool(diagnostics.get("using_fallback"))
    base_status["last_error_code"] = str(diagnostics.get("last_error_code") or "")
    base_status["last_error_message"] = str(diagnostics.get("last_error_message") or "")
    if base_status["using_fallback"] and base_status["last_error_code"].startswith(
        "oauth_"
    ):
        base_status["status"] = "needs_reconnect"
    else:
        base_status["status"] = "connected"
    return base_status


def _escape_name(value: str) -> str:
    return value.replace("'", "\\'")


def _find_folder(folder_name: str, parent_id: str) -> Optional[dict]:
    query = " and ".join(
        (
            f"name = '{_escape_name(folder_name)}'",
            f"'{parent_id}' in parents",
            f"mimeType = '{FOLDER_MIME_TYPE}'",
            "trashed = false",
        )
    )
    try:
        response = _run_with_drive_service(
            "search_drive_folders",
            lambda service: service.files()
            .list(
                q=query,
                spaces="drive",
                fields="files(id, name)",
                pageSize=1,
                supportsAllDrives=True,
            )
            .execute(),
        )
    except Exception as exc:
        raise DriveOperationError("Unable to search for Drive folders.") from exc

    files = (response or {}).get("files") or []
    return files[0] if files else None


def _make_folder(folder_name: str, parent_id: str) -> str:
    metadata = {
        "name": folder_name,
        "mimeType": FOLDER_MIME_TYPE,
        "parents": [parent_id],
    }
    try:
        folder = _run_with_drive_service(
            "create_drive_folder",
            lambda service: service.files()
            .create(
                body=metadata,
                fields="id",
                supportsAllDrives=True,
            )
            .execute(),
        )
    except Exception as exc:
        raise DriveOperationError("Unable to create Drive folder.") from exc

    if not folder:
        raise DriveOperationError("Unable to create Drive folder.")
    return folder["id"]


def _ensure_folder(folder_name: str, parent_id: str) -> str:
    if not parent_id:
        raise DriveConfigurationError("Google Drive root folder is not configured.")

    existing = _find_folder(folder_name, parent_id)
    if existing:
        return existing["id"]

    return _make_folder(folder_name, parent_id)


def _update_instance_folder(instance: models.Model, folder_id: str) -> None:
    if not folder_id or not getattr(instance, "pk", None):
        return
    existing = getattr(instance, "drive_folder_id", None)
    if existing == folder_id:
        return
    instance.__class__.objects.filter(pk=instance.pk).update(drive_folder_id=folder_id)
    setattr(instance, "drive_folder_id", folder_id)


def _get_folder_metadata(folder_id: str) -> Optional[dict]:
    if not folder_id:
        return None
    try:
        metadata = _run_with_drive_service(
            "get_drive_folder_metadata",
            lambda service: service.files()
            .get(fileId=folder_id, fields="id,name,parents", supportsAllDrives=True)
            .execute(),
            return_none_on_statuses=(404, 410),
        )
        return metadata
    except Exception as exc:
        raise DriveOperationError("Unable to verify Drive folder.") from exc


def _rename_drive_folder(folder_id: str, new_name: str) -> None:
    if not folder_id or not new_name:
        return
    metadata = {"name": new_name}
    try:
        _run_with_drive_service(
            "rename_drive_folder",
            lambda service: service.files()
            .update(
                fileId=folder_id,
                body=metadata,
                supportsAllDrives=True,
                fields="id",
            )
            .execute(),
        )
    except Exception as exc:
        raise DriveOperationError("Unable to rename Drive folder.") from exc


def _safe_int(value: Optional[str]) -> Optional[int]:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def upload_file_to_drive(
    folder_id: str,
    file_obj: BinaryIO,
    file_name: str,
    mime_type: Optional[str],
) -> DriveFileInfo:
    """Upload a binary stream to the specified Drive folder."""

    if not folder_id:
        raise DriveOperationError("Folder ID must be provided.")

    if _MediaIoBaseUpload is None:
        raise DriveConfigurationError("Drive upload dependencies are not available.")

    try:
        file_obj.seek(0)
    except Exception:
        pass

    media_body = _MediaIoBaseUpload(
        file_obj,
        mimetype=mime_type or "application/octet-stream",
        resumable=False,
    )

    metadata = {"name": file_name, "parents": [folder_id]}

    try:
        created = _run_with_drive_service(
            "upload_drive_file",
            lambda service: service.files()
            .create(
                body=metadata,
                media_body=media_body,
                fields="id, name, mimeType, size, createdTime, modifiedTime, webViewLink",
                supportsAllDrives=True,
            )
            .execute(),
        )
    except Exception as exc:
        raise DriveOperationError("Unable to upload file to Google Drive.") from exc

    if not created:
        raise DriveOperationError("Unable to upload file to Google Drive.")

    return DriveFileInfo(
        id=created["id"],
        name=created["name"],
        mime_type=created.get("mimeType", mime_type or ""),
        size=_safe_int(created.get("size")),
        created_at=created.get("createdTime"),
        modified_at=created.get("modifiedTime"),
        web_view_link=created.get("webViewLink"),
        is_folder=False,
    )


def _format_folder_name(prefix: str, fallback: str) -> str:
    return prefix.strip() or fallback


def ensure_client_folder(client) -> Optional[str]:
    """Ensure a Drive folder exists for a client and store its ID."""

    root_folder = getattr(settings, "GOOGLE_DRIVE_ROOT_FOLDER_ID", "").strip()
    if not root_folder:
        raise DriveConfigurationError("GOOGLE_DRIVE_ROOT_FOLDER_ID is not configured.")

    name = _format_folder_name(client.name or "client", "client")
    folder_id = getattr(client, "drive_folder_id", None)
    if folder_id:
        existing = _get_folder_metadata(folder_id)
        if existing:
            if existing.get("name") != name:
                try:
                    _rename_drive_folder(folder_id, name)
                except DriveError:
                    logger.exception(
                        "Failed to rename Drive folder for client %s", client.pk
                    )
        else:
            folder_id = None

    if not folder_id:
        folder_id = _ensure_folder(name, root_folder)
    _update_instance_folder(client, folder_id)
    return folder_id


def ensure_deal_folder(deal) -> Optional[str]:
    """Ensure a Deal folder exists inside its client's Drive folder."""

    from apps.clients.models import Client

    client = getattr(deal, "client", None)
    if client is None and deal.client_id:
        client = Client.objects.filter(pk=deal.client_id).first()
    if not client:
        raise DriveConfigurationError("Deal has no client; cannot create Drive folder.")

    client_folder = ensure_client_folder(client)
    if not client_folder:
        return None

    name = _format_folder_name(deal.title or "deal", "deal")
    folder_id = getattr(deal, "drive_folder_id", None)
    if folder_id:
        metadata = _get_folder_metadata(folder_id)
        if metadata:
            if metadata.get("name") != name:
                try:
                    _rename_drive_folder(folder_id, name)
                except DriveError:
                    logger.exception(
                        "Failed to rename Drive folder for deal %s", deal.pk
                    )
            parents = metadata.get("parents") or []
            if client_folder and client_folder not in parents:
                try:
                    move_drive_folder_to_parent(folder_id, client_folder)
                except DriveError:
                    logger.exception("Failed to move Drive folder for deal %s", deal.pk)
            _update_instance_folder(deal, folder_id)
            return folder_id
        folder_id = None

    folder_id = _ensure_folder(name, client_folder)
    _update_instance_folder(deal, folder_id)
    return folder_id


def ensure_policy_folder(policy) -> Optional[str]:
    """Ensure a Policy folder exists inside its deal's Drive folder."""

    from apps.deals.models import Deal

    deal = getattr(policy, "deal", None)
    if deal is None and policy.deal_id:
        deal = Deal.objects.filter(pk=policy.deal_id).first()
    if not deal:
        raise DriveConfigurationError("Policy has no deal; cannot create Drive folder.")

    deal_folder = ensure_deal_folder(deal)
    if not deal_folder:
        return None

    name = _format_folder_name(policy.number or "policy", "policy")
    folder_id = _ensure_folder(name, deal_folder)
    _update_instance_folder(policy, folder_id)
    return folder_id


def ensure_statement_folder(statement) -> Optional[str]:
    """Ensure a Statement folder exists inside the statements root folder."""

    root_folder = getattr(settings, "GOOGLE_DRIVE_ROOT_FOLDER_ID", "").strip()
    if not root_folder:
        raise DriveConfigurationError("GOOGLE_DRIVE_ROOT_FOLDER_ID is not configured.")

    statements_root = _ensure_folder(STATEMENTS_ROOT_FOLDER_NAME, root_folder)
    name = _format_folder_name(statement.name or "statement", "statement")
    folder_id = getattr(statement, "drive_folder_id", None)
    if folder_id:
        metadata = _get_folder_metadata(folder_id)
        if metadata:
            if metadata.get("name") != name:
                try:
                    _rename_drive_folder(folder_id, name)
                except DriveError:
                    logger.exception(
                        "Failed to rename Drive folder for statement %s", statement.pk
                    )
            parents = metadata.get("parents") or []
            if statements_root and statements_root not in parents:
                try:
                    move_drive_folder_to_parent(folder_id, statements_root)
                except DriveError:
                    logger.exception(
                        "Failed to move Drive folder for statement %s", statement.pk
                    )
            _update_instance_folder(statement, folder_id)
            return folder_id
        folder_id = None

    folder_id = _ensure_folder(name, statements_root)
    _update_instance_folder(statement, folder_id)
    return folder_id


def ensure_trash_folder(parent_folder_id: str, name: str = TRASH_FOLDER_NAME) -> str:
    """Ensure a subfolder exists to hold soft-deleted Drive files."""

    if not parent_folder_id:
        raise DriveOperationError("Parent folder ID must be provided.")

    folder_name = (name or TRASH_FOLDER_NAME).strip() or TRASH_FOLDER_NAME
    return _ensure_folder(folder_name, parent_folder_id)


def get_document_library_folder_id() -> str:
    """Return the configured folder ID for shared documentation."""

    library_folder = getattr(
        settings, "GOOGLE_DRIVE_DOCUMENT_LIBRARY_FOLDER_ID", ""
    ).strip()
    if not library_folder:
        raise DriveConfigurationError(
            "GOOGLE_DRIVE_DOCUMENT_LIBRARY_FOLDER_ID is not configured."
        )
    return library_folder


def list_drive_folder_contents(folder_id: str) -> list[DriveFileInfo]:
    """Return normalized metadata for the given Drive folder."""

    if not folder_id:
        raise DriveOperationError("Folder ID must be provided.")

    results: list[DriveFileInfo] = []
    page_token: Optional[str] = None

    while True:
        try:
            response = _run_with_drive_service(
                "list_drive_folder_contents",
                lambda service: service.files()
                .list(
                    q=f"'{folder_id}' in parents and trashed = false",
                    spaces="drive",
                    fields="nextPageToken, files(id, name, mimeType, size, createdTime, modifiedTime, webViewLink)",
                    pageSize=200,
                    pageToken=page_token,
                    supportsAllDrives=True,
                )
                .execute(),
            )
        except Exception as exc:
            raise DriveOperationError("Unable to load Drive folder contents.") from exc

        response_data = response or {}
        for item in response_data.get("files", []):
            size_value = item.get("size")
            size = None
            if size_value:
                try:
                    size = int(size_value)
                except (TypeError, ValueError):
                    size = None
            results.append(
                DriveFileInfo(
                    id=item["id"],
                    name=item["name"],
                    mime_type=item.get("mimeType", ""),
                    size=size,
                    created_at=item.get("createdTime"),
                    modified_at=item.get("modifiedTime"),
                    web_view_link=item.get("webViewLink"),
                    is_folder=item.get("mimeType") == FOLDER_MIME_TYPE,
                    parent_id=folder_id,
                )
            )

        page_token = response_data.get("nextPageToken")
        if not page_token:
            break

    return results


def build_drive_file_tree_map(root_folder_id: str) -> dict[str, DriveFileInfo]:
    """Return a map of all files and folders in a Drive folder tree by ID."""

    if not root_folder_id:
        raise DriveOperationError("Root folder ID must be provided.")

    pending_folder_ids = [root_folder_id]
    visited_folder_ids: set[str] = set()
    items_by_id: dict[str, DriveFileInfo] = {}

    while pending_folder_ids:
        current_folder_id = pending_folder_ids.pop()
        if current_folder_id in visited_folder_ids:
            continue
        visited_folder_ids.add(current_folder_id)

        for item in list_drive_folder_contents(current_folder_id):
            items_by_id[item["id"]] = item
            if item["is_folder"] and item["id"] not in visited_folder_ids:
                pending_folder_ids.append(item["id"])

    return items_by_id


def download_drive_file(file_id: str) -> bytes:
    """Скачать файл из Google Drive и вернуть байты."""

    if not file_id:
        raise DriveOperationError("File ID must be provided.")

    if _MediaIoBaseDownload is None:
        raise DriveConfigurationError("Drive download dependencies are not available.")

    try:

        def _download(service):
            request = service.files().get_media(fileId=file_id, supportsAllDrives=True)
            buffer = BytesIO()
            downloader = _MediaIoBaseDownload(buffer, request)
            done = False
            while not done:
                _, done = downloader.next_chunk()
            buffer.seek(0)
            return buffer.read()

        content = _run_with_drive_service("download_drive_file", _download)
    except Exception as exc:
        raise DriveOperationError("Unable to download Drive file.") from exc

    if content is None:
        raise DriveOperationError("Unable to download Drive file.")
    return content


def move_drive_folder_to_parent(folder_id: str, target_parent_id: str) -> None:
    """Move an existing Drive folder under a new parent folder."""

    if not folder_id or not target_parent_id:
        return

    try:

        def _move(service):
            metadata = (
                service.files()
                .get(fileId=folder_id, fields="parents", supportsAllDrives=True)
                .execute()
            )
            parents = metadata.get("parents") or []
            remove_parents = ",".join(
                [parent for parent in parents if parent != target_parent_id]
            )

            update_kwargs: dict[str, Any] = {
                "fileId": folder_id,
                "addParents": target_parent_id,
                "fields": "id",
                "supportsAllDrives": True,
            }
            if remove_parents:
                update_kwargs["removeParents"] = remove_parents
            service.files().update(**update_kwargs).execute()
            return True

        _run_with_drive_service("move_drive_folder_to_parent", _move)
    except Exception as exc:
        raise DriveOperationError("Unable to move Drive folder.") from exc


def move_drive_file_to_folder(file_id: str, target_folder_id: str) -> None:
    """Move an existing Drive file into another folder."""

    if not file_id or not target_folder_id:
        return

    try:

        def _move(service):
            metadata = (
                service.files()
                .get(fileId=file_id, fields="parents", supportsAllDrives=True)
                .execute()
            )
            parents = metadata.get("parents") or []
            remove_parents = ",".join(
                [parent for parent in parents if parent != target_folder_id]
            )

            update_kwargs: dict[str, Any] = {
                "fileId": file_id,
                "addParents": target_folder_id,
                "fields": "id",
                "supportsAllDrives": True,
            }
            if remove_parents:
                update_kwargs["removeParents"] = remove_parents
            service.files().update(**update_kwargs).execute()
            return True

        _run_with_drive_service("move_drive_file_to_folder", _move)
    except Exception as exc:
        raise DriveOperationError("Unable to move Drive file.") from exc


def rename_drive_file(file_id: str, new_name: str) -> DriveFileInfo:
    """Rename a Drive file and return updated metadata."""

    if not file_id or not new_name:
        raise DriveOperationError("File ID and new name must be provided.")

    try:
        updated = _run_with_drive_service(
            "rename_drive_file",
            lambda service: service.files()
            .update(
                fileId=file_id,
                body={"name": new_name},
                fields="id, name, mimeType, size, createdTime, modifiedTime, webViewLink",
                supportsAllDrives=True,
            )
            .execute(),
        )
    except Exception as exc:
        raise DriveOperationError("Unable to rename Drive file.") from exc

    if not updated:
        raise DriveOperationError("Unable to rename Drive file.")

    return DriveFileInfo(
        id=updated["id"],
        name=updated["name"],
        mime_type=updated.get("mimeType", ""),
        size=_safe_int(updated.get("size")),
        created_at=updated.get("createdTime"),
        modified_at=updated.get("modifiedTime"),
        web_view_link=updated.get("webViewLink"),
        is_folder=updated.get("mimeType") == FOLDER_MIME_TYPE,
    )


def move_drive_folder_contents(source_folder_id: str, target_folder_id: str) -> None:
    """Move the contents of one Drive folder into another folder."""

    if not source_folder_id or not target_folder_id:
        return

    page_token: Optional[str] = None

    while True:
        try:
            response = _run_with_drive_service(
                "list_drive_folder_contents_for_move",
                lambda service: service.files()
                .list(
                    q=f"'{source_folder_id}' in parents and trashed = false",
                    spaces="drive",
                    fields="nextPageToken, files(id)",
                    pageSize=200,
                    pageToken=page_token,
                    supportsAllDrives=True,
                )
                .execute(),
            )
        except Exception as exc:
            raise DriveOperationError("Unable to list Drive folder contents.") from exc

        response_data = response or {}
        for item in response_data.get("files", []):
            try:
                _run_with_drive_service(
                    "move_drive_item_to_folder",
                    lambda service: service.files()
                    .update(
                        fileId=item["id"],
                        addParents=target_folder_id,
                        removeParents=source_folder_id,
                        supportsAllDrives=True,
                        fields="id",
                    )
                    .execute(),
                )
            except Exception as exc:
                raise DriveOperationError("Unable to move Drive file.") from exc

        page_token = response_data.get("nextPageToken")
        if not page_token:
            break


def count_drive_folder_items(folder_id: str) -> int:
    """Count direct non-trashed children inside a Drive folder."""

    if not folder_id:
        return 0

    total = 0
    page_token: Optional[str] = None

    while True:
        try:
            response = _run_with_drive_service(
                "count_drive_folder_items",
                lambda service: service.files()
                .list(
                    q=f"'{folder_id}' in parents and trashed = false",
                    spaces="drive",
                    fields="nextPageToken, files(id)",
                    pageSize=200,
                    pageToken=page_token,
                    supportsAllDrives=True,
                )
                .execute(),
            )
        except Exception as exc:
            raise DriveOperationError("Unable to count Drive folder contents.") from exc

        response_data = response or {}
        total += len(response_data.get("files", []))
        page_token = response_data.get("nextPageToken")
        if not page_token:
            break

    return total


def move_drive_folder_contents_verified(
    source_folder_id: str, target_folder_id: str
) -> DriveFolderMoveVerification:
    """Move folder contents and verify transfer by before/after counts."""

    source_before_count = count_drive_folder_items(source_folder_id)
    target_before_count = count_drive_folder_items(target_folder_id)

    move_drive_folder_contents(source_folder_id, target_folder_id)

    source_after_count = count_drive_folder_items(source_folder_id)
    target_after_count = count_drive_folder_items(target_folder_id)

    if source_after_count != 0:
        raise DriveOperationError(
            "Drive folder transfer verification failed: source folder is not empty."
        )
    if (target_after_count - target_before_count) < source_before_count:
        raise DriveOperationError(
            "Drive folder transfer verification failed: target folder item count did not increase as expected."
        )

    return {
        "source_before_count": source_before_count,
        "source_after_count": source_after_count,
        "target_before_count": target_before_count,
        "target_after_count": target_after_count,
    }


def delete_drive_folder(folder_id: str) -> None:
    """Delete a Drive folder."""

    if not folder_id:
        return

    try:
        _run_with_drive_service(
            "delete_drive_folder",
            lambda service: service.files()
            .delete(fileId=folder_id, supportsAllDrives=True)
            .execute(),
            return_none_on_statuses=(404, 410),
        )
    except Exception as exc:
        raise DriveOperationError("Unable to delete Drive folder.") from exc


def try_delete_drive_folder(folder_id: str) -> DriveFolderDeleteAttempt:
    """Attempt to delete a Drive folder and return the outcome."""

    try:
        delete_drive_folder(folder_id)
    except DriveError as exc:
        return {
            "deleted": False,
            "error": str(exc).strip() or "Unable to delete Drive folder.",
        }
    return {"deleted": True, "error": ""}
