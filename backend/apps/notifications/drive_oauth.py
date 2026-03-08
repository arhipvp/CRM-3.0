from __future__ import annotations

import json
import os
import shlex
import subprocess
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Any
from urllib.parse import urlencode, urlsplit, urlunsplit
from urllib.request import Request, urlopen

from apps.common import drive
from apps.common.drive import (
    DEFAULT_GOOGLE_OAUTH_TOKEN_URI,
    DRIVE_SCOPES,
    DriveConfigurationError,
    get_drive_connection_status,
)
from django.conf import settings
from django.core import signing
from django.http import HttpRequest
from django.utils import timezone


class DriveReconnectError(Exception):
    """Raised when the reconnect flow cannot be completed."""


def is_drive_reconnect_user(user) -> bool:
    if not getattr(user, "is_authenticated", False):
        return False

    allowed_id = int(getattr(settings, "GOOGLE_DRIVE_RECONNECT_ALLOWED_USER_ID", 4))
    allowed_username = str(
        getattr(settings, "GOOGLE_DRIVE_RECONNECT_ALLOWED_USERNAME", "Vova") or ""
    ).strip()
    if allowed_username and user.username == allowed_username:
        return True
    return bool(allowed_id and user.id == allowed_id)


def get_drive_status_for_user(user) -> dict[str, Any]:
    status = get_drive_connection_status()
    status["reconnect_available"] = bool(
        status["reconnect_available"] and is_drive_reconnect_user(user)
    )
    return status


def build_reconnect_url(*, request: HttpRequest, user) -> str:
    if not is_drive_reconnect_user(user):
        raise DriveReconnectError(
            "Google Drive reconnect is available only for the Vova account."
        )

    client_id = str(getattr(settings, "GOOGLE_DRIVE_OAUTH_CLIENT_ID", "") or "").strip()
    client_secret = str(
        getattr(settings, "GOOGLE_DRIVE_OAUTH_CLIENT_SECRET", "") or ""
    ).strip()
    if not client_id or not client_secret:
        raise DriveConfigurationError(
            "Google Drive OAuth client credentials are not configured."
        )

    redirect_uri = _get_redirect_uri(request)
    payload = {
        "user_id": user.id,
        "username": user.username,
        "issued_at": timezone.now().isoformat(),
    }
    state = signing.dumps(payload, salt="google-drive-reconnect")
    query = urlencode(
        {
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": " ".join(DRIVE_SCOPES),
            "access_type": "offline",
            "prompt": "consent",
            "include_granted_scopes": "true",
            "state": state,
        }
    )
    return f"https://accounts.google.com/o/oauth2/v2/auth?{query}"


def complete_reconnect(*, request: HttpRequest) -> dict[str, Any]:
    error = str(request.GET.get("error") or "").strip()
    if error:
        raise DriveReconnectError(f"Google OAuth returned error: {error}")

    code = str(request.GET.get("code") or "").strip()
    state = str(request.GET.get("state") or "").strip()
    if not code or not state:
        raise DriveReconnectError("Google OAuth callback is missing code or state.")

    try:
        payload = signing.loads(state, salt="google-drive-reconnect", max_age=900)
    except signing.BadSignature as exc:
        raise DriveReconnectError("Google OAuth callback state is invalid.") from exc
    except signing.SignatureExpired as exc:
        raise DriveReconnectError("Google OAuth callback state has expired.") from exc

    if payload.get("username") != str(
        getattr(settings, "GOOGLE_DRIVE_RECONNECT_ALLOWED_USERNAME", "Vova")
    ) or int(payload.get("user_id") or 0) != int(
        getattr(settings, "GOOGLE_DRIVE_RECONNECT_ALLOWED_USER_ID", 4)
    ):
        raise DriveReconnectError("Google OAuth callback user is not allowed.")

    token_payload = _exchange_code_for_token(
        code=code, redirect_uri=_get_redirect_uri(request)
    )
    refresh_token = str(token_payload.get("refresh_token") or "").strip()
    if not refresh_token:
        raise DriveReconnectError(
            "Google OAuth did not return a refresh token. Reconnect with consent again."
        )

    _verify_refresh_token(refresh_token)
    token_path = _write_refresh_token(refresh_token)
    command_result = _run_post_update_command()
    status = get_drive_connection_status()
    return {
        "token_path": token_path,
        "post_update": command_result,
        "drive_status": status,
    }


def build_callback_redirect_url(
    *, request: HttpRequest, success: bool, message: str
) -> str:
    base_url = _get_settings_redirect_url(request)
    split = urlsplit(base_url)
    query_items = []
    if split.query:
        query_items.append(split.query)
    query_items.append(
        urlencode(
            {
                "driveReconnect": "success" if success else "error",
                "driveReconnectMessage": message,
            }
        )
    )
    return urlunsplit(
        (split.scheme, split.netloc, split.path, "&".join(query_items), split.fragment)
    )


def _get_redirect_uri(request: HttpRequest) -> str:
    configured = str(
        getattr(settings, "GOOGLE_DRIVE_OAUTH_REDIRECT_URI", "") or ""
    ).strip()
    if configured:
        return configured
    return request.build_absolute_uri("/api/v1/notifications/settings/drive-callback/")


def _get_settings_redirect_url(request: HttpRequest) -> str:
    configured = str(
        getattr(settings, "GOOGLE_DRIVE_RECONNECT_SUCCESS_URL", "") or ""
    ).strip()
    if configured:
        return configured
    base_url = str(getattr(settings, "CRM_PUBLIC_URL", "") or "").strip().rstrip("/")
    if base_url:
        return f"{base_url}/settings"
    return request.build_absolute_uri("/settings")


def _exchange_code_for_token(*, code: str, redirect_uri: str) -> dict[str, Any]:
    token_uri = str(
        getattr(
            settings, "GOOGLE_DRIVE_OAUTH_TOKEN_URI", DEFAULT_GOOGLE_OAUTH_TOKEN_URI
        )
        or DEFAULT_GOOGLE_OAUTH_TOKEN_URI
    ).strip()
    payload = urlencode(
        {
            "code": code,
            "client_id": getattr(settings, "GOOGLE_DRIVE_OAUTH_CLIENT_ID", ""),
            "client_secret": getattr(settings, "GOOGLE_DRIVE_OAUTH_CLIENT_SECRET", ""),
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
        }
    ).encode("utf-8")
    request = Request(
        token_uri,
        data=payload,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=30) as response:
            data = response.read().decode("utf-8")
    except Exception as exc:
        raise DriveReconnectError(
            "Unable to exchange Google OAuth code for token."
        ) from exc

    try:
        return json.loads(data)
    except json.JSONDecodeError as exc:
        raise DriveReconnectError(
            "Google OAuth token response is invalid JSON."
        ) from exc


def _verify_refresh_token(refresh_token: str) -> None:
    if not drive._oauth_credentials:
        raise DriveConfigurationError(
            "google-auth OAuth credentials support is not available."
        )

    credentials = drive._oauth_credentials.Credentials(
        token=None,
        refresh_token=refresh_token,
        token_uri=(
            getattr(settings, "GOOGLE_DRIVE_OAUTH_TOKEN_URI", "")
            or DEFAULT_GOOGLE_OAUTH_TOKEN_URI
        ).strip(),
        client_id=str(
            getattr(settings, "GOOGLE_DRIVE_OAUTH_CLIENT_ID", "") or ""
        ).strip(),
        client_secret=str(
            getattr(settings, "GOOGLE_DRIVE_OAUTH_CLIENT_SECRET", "") or ""
        ).strip(),
        scopes=DRIVE_SCOPES,
    )
    service = drive._build_drive_client(
        credentials, auth_type=drive.DRIVE_AUTH_MODE_OAUTH
    )
    root_folder_id = str(
        getattr(settings, "GOOGLE_DRIVE_ROOT_FOLDER_ID", "") or ""
    ).strip()
    if not root_folder_id:
        raise DriveConfigurationError("GOOGLE_DRIVE_ROOT_FOLDER_ID is not configured.")
    try:
        service.files().get(
            fileId=root_folder_id,
            fields="id,name",
            supportsAllDrives=True,
        ).execute()
    except Exception as exc:
        raise DriveReconnectError(
            "Unable to verify the new Google Drive refresh token."
        ) from exc


def _write_refresh_token(refresh_token: str) -> str:
    token_file = str(
        getattr(settings, "GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN_FILE", "") or ""
    ).strip()
    if not token_file:
        raise DriveConfigurationError(
            "GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN_FILE is not configured."
        )

    path = Path(token_file)
    path.parent.mkdir(parents=True, exist_ok=True)
    with NamedTemporaryFile(
        mode="w", encoding="utf-8", delete=False, dir=path.parent
    ) as tmp:
        tmp.write(refresh_token)
        tmp.write("\n")
        temp_name = tmp.name
    os.replace(temp_name, path)
    try:
        os.chmod(path, 0o600)
    except OSError:
        pass
    return str(path)


def _run_post_update_command() -> dict[str, Any]:
    command = str(
        getattr(settings, "GOOGLE_DRIVE_OAUTH_POST_UPDATE_COMMAND", "") or ""
    ).strip()
    if not command:
        return {"performed": False, "returncode": 0}

    try:
        completed = subprocess.run(
            command,
            shell=True,
            check=False,
            capture_output=True,
            text=True,
            timeout=60,
        )
    except Exception as exc:
        raise DriveReconnectError(
            "Google Drive token was updated, but the post-update command failed to start."
        ) from exc

    if completed.returncode != 0:
        command_name = shlex.split(command)[0] if shlex.split(command) else command
        raise DriveReconnectError(
            f"Google Drive token was updated, but post-update command failed: {command_name}"
        )
    return {"performed": True, "returncode": completed.returncode}
