from __future__ import annotations

import base64
import json
import logging
import mimetypes
import socket
import urllib.error
import urllib.request
from io import BytesIO

from apps.clients.models import Client
from apps.common.drive import (
    DriveConfigurationError,
    DriveError,
    DriveOperationError,
    ensure_deal_folder,
    upload_file_to_drive,
)
from apps.deals.models import Deal
from apps.documents.models import Document
from apps.notes.models import Note
from django.conf import settings
from django.core.files.base import ContentFile
from django.utils import timezone

from .models import TelegramInboundMessage

DEFAULT_TELEGRAM_CLIENT_NAME = "Клиент из Telegram"


def find_or_create_client(*, user, extracted_data):
    default_name = str(
        getattr(
            settings,
            "TELEGRAM_INTAKE_DEFAULT_CLIENT_NAME",
            DEFAULT_TELEGRAM_CLIENT_NAME,
        )
        or DEFAULT_TELEGRAM_CLIENT_NAME
    ).strip()
    if not default_name:
        default_name = DEFAULT_TELEGRAM_CLIENT_NAME

    existing = (
        Client.objects.alive()
        .filter(name__iexact=default_name)
        .order_by("-created_at")
        .first()
    )
    if existing:
        return existing
    return Client.objects.create(name=default_name[:255], created_by=user)


def build_drive_failure_hint(failure_codes: set[str]) -> str:
    if not failure_codes:
        return ""
    if "config" in failure_codes:
        return "внутренняя интеграция Google Drive не настроена"
    if "folder" in failure_codes:
        return "Google Drive недоступен или нет доступа к папке сделки"
    if "upload" in failure_codes:
        return "файл не удалось загрузить в Google Drive"
    return "Google Drive недоступен или не принял файл"


def upload_attachment_via_backend_api(
    *,
    user,
    deal: Deal,
    file_name: str,
    mime_type: str,
    content: bytes,
    logger: logging.Logger,
) -> tuple[bool, str | None] | None:
    base_url = str(getattr(settings, "TELEGRAM_INTERNAL_API_URL", "")).strip()
    if not base_url:
        return None

    token = str(getattr(settings, "TELEGRAM_INTERNAL_API_TOKEN", "")).strip()
    if not token:
        logger.warning(
            "Telegram internal API upload disabled: TELEGRAM_INTERNAL_API_TOKEN is missing."
        )
        return False, "config"

    timeout = float(
        getattr(settings, "TELEGRAM_INTERNAL_API_TIMEOUT_SECONDS", 15) or 15
    )
    endpoint = (
        f"{base_url.rstrip('/')}/api/v1/notifications/telegram-intake/upload-drive/"
    )
    payload = {
        "user_id": str(user.id),
        "deal_id": str(deal.id),
        "file_name": file_name,
        "mime_type": mime_type,
        "content_base64": base64.b64encode(content).decode("ascii"),
    }
    body = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        endpoint,
        data=body,
        headers={
            "Content-Type": "application/json",
            "X-Telegram-Internal-Token": token,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            response_body = response.read().decode("utf-8", errors="ignore")
            parsed = json.loads(response_body) if response_body else {}
            if int(getattr(response, "status", 0) or 0) >= 300:
                logger.warning(
                    "Telegram internal API upload failed. deal=%s file=%s status=%s detail=%s",
                    deal.id,
                    file_name,
                    getattr(response, "status", 0),
                    parsed.get("detail"),
                )
                return False, "upload"
            if parsed.get("ok"):
                return True, None
            logger.warning(
                "Telegram internal API upload returned unexpected response. deal=%s file=%s payload=%s",
                deal.id,
                file_name,
                parsed,
            )
            return False, "upload"
    except urllib.error.HTTPError as exc:
        failure_code = "upload"
        if exc.code == 403:
            failure_code = "config"
        elif exc.code in {400, 404}:
            failure_code = "folder"
        detail = ""
        try:
            detail = exc.read().decode("utf-8", errors="ignore")
        except Exception:  # noqa: BLE001
            detail = ""
        logger.warning(
            "Telegram internal API upload HTTP error. deal=%s file=%s status=%s code=%s detail=%s",
            deal.id,
            file_name,
            exc.status if hasattr(exc, "status") else exc.code,
            failure_code,
            detail[:500],
        )
        return False, failure_code
    except (socket.timeout, TimeoutError) as exc:
        logger.warning(
            "Telegram internal API upload timeout. deal=%s file=%s: %s",
            deal.id,
            file_name,
            exc,
        )
        return False, "upload"
    except (urllib.error.URLError, json.JSONDecodeError) as exc:
        logger.warning(
            "Telegram internal API upload transport error. deal=%s file=%s: %s",
            deal.id,
            file_name,
            exc,
        )
        return False, "upload"


def upload_attachment_to_drive(
    *,
    user,
    deal: Deal,
    file_name: str,
    mime_type: str,
    content: bytes,
    logger: logging.Logger,
) -> tuple[bool, str | None]:
    api_mode_result = upload_attachment_via_backend_api(
        user=user,
        deal=deal,
        file_name=file_name,
        mime_type=mime_type,
        content=content,
        logger=logger,
    )
    if api_mode_result is not None:
        return api_mode_result

    try:
        folder_id = ensure_deal_folder(deal) or deal.drive_folder_id
        if not folder_id:
            logger.warning(
                "Telegram attachment Drive upload skipped for deal=%s file=%s: folder_id is empty",
                deal.id,
                file_name,
            )
            return False, "folder"
        upload_file_to_drive(
            folder_id=folder_id,
            file_obj=BytesIO(content),
            file_name=file_name,
            mime_type=mime_type or "application/octet-stream",
        )
        return True, None
    except DriveConfigurationError as exc:
        logger.warning(
            "Telegram attachment Drive config error for deal=%s file=%s: %s",
            deal.id,
            file_name,
            exc,
        )
        return False, "config"
    except DriveOperationError as exc:
        error_text = str(exc or "").lower()
        failure_code = "upload"
        if "folder" in error_text or "verify drive folder" in error_text:
            failure_code = "folder"
        logger.warning(
            "Telegram attachment Drive operation failed for deal=%s file=%s code=%s: %s",
            deal.id,
            file_name,
            failure_code,
            exc,
        )
        return False, failure_code
    except DriveError as exc:
        logger.warning(
            "Telegram attachment Drive upload failed for deal=%s file=%s: %s",
            deal.id,
            file_name,
            exc,
        )
        return False, "upload"


def attach_batch_to_deal(
    *, tg_client, user, session, deal, final_status, logger: logging.Logger
):
    message_ids = list(session.batch_message_ids or [])
    first = (
        TelegramInboundMessage.objects.filter(routing_session=session)
        .order_by("created_at")
        .first()
    )
    chat_id = getattr(first, "chat_id", None)
    body = str(session.aggregated_text or "").strip() or "(в пакете только вложения)"
    Note.objects.create(
        deal=deal,
        body=(
            "Источник: Telegram (batch)\n"
            f"Chat ID: {chat_id or '-'}\n"
            f"Message IDs: {', '.join(str(item) for item in message_ids) or '-'}\n\n"
            f"{body}"
        ),
        author=user,
        author_name="Telegram bot",
    )
    saved, failed = 0, 0
    failure_codes: set[str] = set()
    for idx, item in enumerate(session.aggregated_attachments or [], start=1):
        file_id = str(item.get("file_id") or "").strip()
        if not file_id:
            continue
        try:
            file_data = tg_client.get_file(file_id)
            file_path = str((file_data or {}).get("file_path") or "").strip()
            if not file_path:
                raise ValueError("Telegram file_path is empty")
            content = tg_client.download_file(file_path)
            if content is None:
                raise ValueError("Telegram file content is empty")
            file_name = str(item.get("file_name") or "").strip()
            if not file_name:
                prefix = message_ids[0] if message_ids else "batch"
                file_name = (
                    f"telegram_{prefix}_{idx}.jpg"
                    if item.get("kind") == "photo"
                    else f"telegram_{prefix}_{idx}.bin"
                )
            mime_type = str(item.get("mime_type") or "").strip() or (
                mimetypes.guess_type(file_name)[0] or ""
            )
            document = Document(
                deal=deal, owner=user, title=file_name[:255], mime_type=mime_type
            )
            document.file.save(file_name, ContentFile(content), save=False)
            document.save()
            drive_uploaded, failure_code = upload_attachment_to_drive(
                user=user,
                deal=deal,
                file_name=file_name,
                mime_type=mime_type,
                content=content,
                logger=logger,
            )
            if drive_uploaded:
                saved += 1
            else:
                failed += 1
                if failure_code:
                    failure_codes.add(failure_code)
        except Exception as exc:  # noqa: BLE001
            failed += 1
            failure_codes.add("unexpected")
            logger.warning(
                "Telegram attachment save failed for session=%s file_id=%s: %s",
                session.id,
                file_id,
                exc,
            )
    TelegramInboundMessage.objects.filter(routing_session=session).update(
        linked_deal=deal,
        processed_at=timezone.now(),
        status=final_status,
    )
    return saved, failed, build_drive_failure_hint(failure_codes)
