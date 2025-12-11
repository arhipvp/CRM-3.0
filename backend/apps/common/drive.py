"""Utilities to manage Google Drive folders used by the CRM."""

from __future__ import annotations

import logging
from io import BytesIO
from typing import Any, BinaryIO, Optional, TypedDict

from django.conf import settings
from django.db import models

logger = logging.getLogger(__name__)

try:
    from google.oauth2 import service_account as _service_account
    from googleapiclient.discovery import build as _gdrive_build
    from googleapiclient.errors import HttpError as _GDriveHttpError
    from googleapiclient.http import MediaIoBaseDownload as _MediaIoBaseDownload
    from googleapiclient.http import MediaIoBaseUpload as _MediaIoBaseUpload
except ImportError as exc:  # pragma: no cover - requires optional dependency
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


def _get_drive_service():
    if _drive_import_error:
        raise DriveConfigurationError(
            "google-api-python-client and google-auth must be installed to work with Drive."
        )

    if not _gdrive_build or not _service_account:
        raise DriveConfigurationError("Drive client dependencies are not available.")

    keyfile = getattr(settings, "GOOGLE_DRIVE_SERVICE_ACCOUNT_FILE", "").strip()
    if not keyfile:
        raise DriveConfigurationError(
            "GOOGLE_DRIVE_SERVICE_ACCOUNT_FILE is not configured."
        )

    try:
        credentials = _service_account.Credentials.from_service_account_file(
            keyfile, scopes=DRIVE_SCOPES
        )
        return _gdrive_build(
            "drive", "v3", credentials=credentials, cache_discovery=False
        )
    except Exception as exc:  # pragma: no cover - relies on third-party errors
        logger.exception("Failed to initialize Google Drive client")
        raise DriveConfigurationError(
            "Unable to initialize Google Drive client."
        ) from exc


def _escape_name(value: str) -> str:
    return value.replace("'", "\\'")


def _find_folder(folder_name: str, parent_id: str) -> Optional[dict]:
    service = _get_drive_service()
    query = " and ".join(
        (
            f"name = '{_escape_name(folder_name)}'",
            f"'{parent_id}' in parents",
            f"mimeType = '{FOLDER_MIME_TYPE}'",
            "trashed = false",
        )
    )
    try:
        response = (
            service.files()
            .list(
                q=query,
                spaces="drive",
                fields="files(id, name)",
                pageSize=1,
                supportsAllDrives=True,
            )
            .execute()
        )
    except Exception as exc:
        logger.exception("Error while searching Drive folders")
        raise DriveOperationError("Unable to search for Drive folders.") from exc

    files = response.get("files") or []
    return files[0] if files else None


def _make_folder(folder_name: str, parent_id: str) -> str:
    service = _get_drive_service()
    metadata = {
        "name": folder_name,
        "mimeType": FOLDER_MIME_TYPE,
        "parents": [parent_id],
    }
    try:
        folder = (
            service.files()
            .create(
                body=metadata,
                fields="id",
                supportsAllDrives=True,
            )
            .execute()
        )
    except Exception as exc:
        logger.exception("Error while creating Drive folder")
        raise DriveOperationError("Unable to create Drive folder.") from exc

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
    service = _get_drive_service()
    try:
        return (
            service.files()
            .get(fileId=folder_id, fields="id,name,parents", supportsAllDrives=True)
            .execute()
        )
    except Exception as exc:
        if _GDriveHttpError and isinstance(exc, _GDriveHttpError):
            resp = getattr(exc, "resp", None)
            status = getattr(resp, "status", None) if resp is not None else None
            if status in (404, 410):
                return None
        logger.exception("Error while fetching Drive folder metadata")
        raise DriveOperationError("Unable to verify Drive folder.") from exc


def _rename_drive_folder(folder_id: str, new_name: str) -> None:
    if not folder_id or not new_name:
        return
    service = _get_drive_service()
    metadata = {"name": new_name}
    try:
        (
            service.files()
            .update(
                fileId=folder_id,
                body=metadata,
                supportsAllDrives=True,
                fields="id",
            )
            .execute()
        )
    except Exception as exc:
        logger.exception("Error while renaming Drive folder")
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

    service = _get_drive_service()
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
        created = (
            service.files()
            .create(
                body=metadata,
                media_body=media_body,
                fields="id, name, mimeType, size, createdTime, modifiedTime, webViewLink",
                supportsAllDrives=True,
            )
            .execute()
        )
    except Exception as exc:
        logger.exception("Error uploading file to Drive")
        raise DriveOperationError("Unable to upload file to Google Drive.") from exc

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

    service = _get_drive_service()
    results: list[DriveFileInfo] = []
    page_token: Optional[str] = None

    while True:
        try:
            response = (
                service.files()
                .list(
                    q=f"'{folder_id}' in parents and trashed = false",
                    spaces="drive",
                    fields="nextPageToken, files(id, name, mimeType, size, createdTime, modifiedTime, webViewLink)",
                    pageSize=200,
                    pageToken=page_token,
                    supportsAllDrives=True,
                )
                .execute()
            )
        except Exception as exc:
            logger.exception("Error while loading Drive folder contents")
            raise DriveOperationError("Unable to load Drive folder contents.") from exc

        for item in response.get("files", []):
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

        page_token = response.get("nextPageToken")
        if not page_token:
            break

    return results


def download_drive_file(file_id: str) -> bytes:
    """Скачать файл из Google Drive и вернуть байты."""

    if not file_id:
        raise DriveOperationError("File ID must be provided.")

    if _MediaIoBaseDownload is None:
        raise DriveConfigurationError("Drive download dependencies are not available.")

    service = _get_drive_service()
    try:
        request = service.files().get_media(fileId=file_id, supportsAllDrives=True)
        buffer = BytesIO()
        downloader = _MediaIoBaseDownload(buffer, request)
        done = False
        while not done:
            _, done = downloader.next_chunk()
    except Exception as exc:
        logger.exception("Error while downloading Drive file")
        raise DriveOperationError("Unable to download Drive file.") from exc

    buffer.seek(0)
    return buffer.read()


def move_drive_folder_to_parent(folder_id: str, target_parent_id: str) -> None:
    """Move an existing Drive folder under a new parent folder."""

    if not folder_id or not target_parent_id:
        return

    service = _get_drive_service()
    try:
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
    except Exception as exc:
        logger.exception("Error while moving Drive folder to a new parent")
        raise DriveOperationError("Unable to move Drive folder.") from exc


def move_drive_file_to_folder(file_id: str, target_folder_id: str) -> None:
    """Move an existing Drive file into another folder."""

    if not file_id or not target_folder_id:
        return

    service = _get_drive_service()
    try:
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
    except Exception as exc:
        logger.exception("Error while moving Drive file to another folder")
        raise DriveOperationError("Unable to move Drive file.") from exc


def move_drive_folder_contents(source_folder_id: str, target_folder_id: str) -> None:
    """Move the contents of one Drive folder into another folder."""

    if not source_folder_id or not target_folder_id:
        return

    service = _get_drive_service()
    page_token: Optional[str] = None

    while True:
        try:
            response = (
                service.files()
                .list(
                    q=f"'{source_folder_id}' in parents and trashed = false",
                    spaces="drive",
                    fields="nextPageToken, files(id)",
                    pageSize=200,
                    pageToken=page_token,
                    supportsAllDrives=True,
                )
                .execute()
            )
        except Exception as exc:
            logger.exception("Error while listing Drive folder contents")
            raise DriveOperationError("Unable to list Drive folder contents.") from exc

        for item in response.get("files", []):
            try:
                service.files().update(
                    fileId=item["id"],
                    addParents=target_folder_id,
                    removeParents=source_folder_id,
                    supportsAllDrives=True,
                    fields="id",
                ).execute()
            except Exception as exc:
                logger.exception("Error while moving Drive item to target folder")
                raise DriveOperationError("Unable to move Drive file.") from exc

        page_token = response.get("nextPageToken")
        if not page_token:
            break


def delete_drive_folder(folder_id: str) -> None:
    """Delete a Drive folder."""

    if not folder_id:
        return

    service = _get_drive_service()
    try:
        service.files().delete(fileId=folder_id, supportsAllDrives=True).execute()
    except Exception as exc:
        logger.exception("Error while deleting Drive folder")
        raise DriveOperationError("Unable to delete Drive folder.") from exc
