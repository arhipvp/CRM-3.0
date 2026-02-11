"""Utilities to manage Google Drive folders used by the CRM."""

from __future__ import annotations

import json
import logging
from io import BytesIO
from typing import Any, BinaryIO, Callable, Optional, TypedDict, TypeVar

from django.conf import settings
from django.db import models

logger = logging.getLogger(__name__)

try:
    from google.oauth2 import credentials as _oauth_credentials
    from google.oauth2 import service_account as _service_account
    from googleapiclient.discovery import build as _gdrive_build
    from googleapiclient.errors import HttpError as _GDriveHttpError
    from googleapiclient.http import MediaIoBaseDownload as _MediaIoBaseDownload
    from googleapiclient.http import MediaIoBaseUpload as _MediaIoBaseUpload
except ImportError as exc:  # pragma: no cover - requires optional dependency
    _oauth_credentials = None
    _gdrive_build = None
    _GDriveHttpError = None
    _MediaIoBaseUpload = None
    _MediaIoBaseDownload = None
    _service_account = None
    _drive_import_error = exc
else:
    _drive_import_error = None

DRIVE_SCOPES = ("https://www.googleapis.com/auth/drive",)
FOLDER_MIME_TYPE = "application/vnd.google-apps.folder"
TRASH_FOLDER_NAME = "Корзина"
STATEMENTS_ROOT_FOLDER_NAME = "Ведомости"
DEFAULT_GOOGLE_OAUTH_TOKEN_URI = "https://oauth2.googleapis.com/token"
DRIVE_AUTH_MODE_AUTO = "auto"
DRIVE_AUTH_MODE_OAUTH = "oauth"
DRIVE_AUTH_MODE_SERVICE_ACCOUNT = "service_account"
DRIVE_FALLBACK_HTTP_STATUSES = (401, 403, 404, 410)

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


def _ensure_drive_dependencies() -> None:
    if _drive_import_error:
        raise DriveConfigurationError(
            "google-api-python-client and google-auth must be installed to work with Drive."
        )

    if not _gdrive_build:
        raise DriveConfigurationError("Drive client dependencies are not available.")


def _get_drive_auth_mode() -> str:
    mode = getattr(settings, "GOOGLE_DRIVE_AUTH_MODE", DRIVE_AUTH_MODE_AUTO)
    normalized = (mode or DRIVE_AUTH_MODE_AUTO).strip().lower()
    allowed_modes = {
        DRIVE_AUTH_MODE_AUTO,
        DRIVE_AUTH_MODE_OAUTH,
        DRIVE_AUTH_MODE_SERVICE_ACCOUNT,
    }
    if normalized not in allowed_modes:
        raise DriveConfigurationError(
            "GOOGLE_DRIVE_AUTH_MODE must be one of: auto, oauth, service_account."
        )
    return normalized


def _get_oauth_settings() -> dict[str, str]:
    return {
        "client_id": getattr(settings, "GOOGLE_DRIVE_OAUTH_CLIENT_ID", "").strip(),
        "client_secret": getattr(
            settings, "GOOGLE_DRIVE_OAUTH_CLIENT_SECRET", ""
        ).strip(),
        "refresh_token": getattr(
            settings, "GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN", ""
        ).strip(),
        "token_uri": (
            getattr(settings, "GOOGLE_DRIVE_OAUTH_TOKEN_URI", "")
            or DEFAULT_GOOGLE_OAUTH_TOKEN_URI
        ).strip(),
    }


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


def _build_service_account_drive_service():
    if not _service_account:
        raise DriveConfigurationError("Service account dependencies are not available.")

    keyfile = getattr(settings, "GOOGLE_DRIVE_SERVICE_ACCOUNT_FILE", "").strip()
    if not keyfile:
        return None
    credentials = _service_account.Credentials.from_service_account_file(
        keyfile, scopes=DRIVE_SCOPES
    )
    return _build_drive_client(credentials, auth_type=DRIVE_AUTH_MODE_SERVICE_ACCOUNT)


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


def _log_drive_api_failure(operation: str, auth_type: str, exc: Exception) -> None:
    status, reason = _extract_http_error_status_reason(exc)
    if status is None:
        logger.error(
            "Google Drive operation failed. operation=%s auth=%s",
            operation,
            auth_type,
            exc_info=True,
        )
        return

    logger.error(
        "Google Drive API error. operation=%s auth=%s status=%s reason=%s",
        operation,
        auth_type,
        status,
        reason or "unknown",
        exc_info=True,
    )
    if status in (401, 403):
        logger.error(
            "Google Drive alert. operation=%s auth=%s status=%s reason=%s",
            operation,
            auth_type,
            status,
            reason or "unknown",
        )


def _get_drive_services() -> list[tuple[str, Any]]:
    _ensure_drive_dependencies()
    auth_mode = _get_drive_auth_mode()
    oauth_service = _build_oauth_drive_service()
    service_account_service = _build_service_account_drive_service()

    if auth_mode == DRIVE_AUTH_MODE_OAUTH:
        if not oauth_service:
            raise DriveConfigurationError(
                "OAuth mode is enabled but OAuth credentials are not configured."
            )
        return [(DRIVE_AUTH_MODE_OAUTH, oauth_service)]

    if auth_mode == DRIVE_AUTH_MODE_SERVICE_ACCOUNT:
        if not service_account_service:
            raise DriveConfigurationError(
                "Service account mode is enabled but GOOGLE_DRIVE_SERVICE_ACCOUNT_FILE is not configured."
            )
        return [(DRIVE_AUTH_MODE_SERVICE_ACCOUNT, service_account_service)]

    services: list[tuple[str, Any]] = []
    if oauth_service:
        services.append((DRIVE_AUTH_MODE_OAUTH, oauth_service))
    if service_account_service:
        services.append((DRIVE_AUTH_MODE_SERVICE_ACCOUNT, service_account_service))
    if not services:
        raise DriveConfigurationError(
            "Google Drive credentials are not configured. Set OAuth credentials or GOOGLE_DRIVE_SERVICE_ACCOUNT_FILE."
        )
    return services


def _run_with_drive_service(
    operation: str,
    action: Callable[[Any], _T],
    *,
    return_none_on_statuses: tuple[int, ...] = (),
) -> Optional[_T]:
    services = _get_drive_services()
    for index, (auth_type, service) in enumerate(services):
        has_fallback = index < len(services) - 1
        try:
            return action(service)
        except Exception as exc:
            status, reason = _extract_http_error_status_reason(exc)
            _log_drive_api_failure(operation, auth_type, exc)
            if (
                status in return_none_on_statuses
                and has_fallback
                and status in DRIVE_FALLBACK_HTTP_STATUSES
            ):
                logger.warning(
                    "Retrying Drive operation with fallback auth. operation=%s status=%s reason=%s",
                    operation,
                    status,
                    reason or "unknown",
                )
                continue
            if status in return_none_on_statuses:
                return None
            if has_fallback and status in DRIVE_FALLBACK_HTTP_STATUSES:
                logger.warning(
                    "Retrying Drive operation with fallback auth. operation=%s status=%s reason=%s",
                    operation,
                    status,
                    reason or "unknown",
                )
                continue
            raise
    return None


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
                )
            )

        page_token = response_data.get("nextPageToken")
        if not page_token:
            break

    return results


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
        )
    except Exception as exc:
        raise DriveOperationError("Unable to delete Drive folder.") from exc
