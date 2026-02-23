from __future__ import annotations

import re
from datetime import timedelta

from django.utils import timezone

from .models import TelegramDealRoutingSession

PHONE_RE = re.compile(r"(?:\+?\d[\d\s\-\(\)]{8,}\d)")
EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
CLIENT_RE = re.compile(
    r"(?:клиент|фио|страхователь)\s*[:\-]\s*([A-Za-zА-Яа-яЁё][^,\n]{2,80})",
    re.IGNORECASE,
)
NAME_LINE_RE = re.compile(
    r"\b([А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+){1,2}|[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\b"
)
NAME_TOKEN_RE = re.compile(r"[A-Za-zА-Яа-яЁё]+")
BATCH_TIMEOUT_SECONDS = 60
SESSION_TTL_MINUTES = 30


def normalize_phone(value: str) -> str:
    digits = "".join(ch for ch in (value or "") if ch.isdigit())
    if len(digits) == 11 and digits.startswith("8"):
        digits = "7" + digits[1:]
    return digits


def extract_forward_sender_name(message: dict) -> str:
    sender_name = str(message.get("forward_sender_name") or "").strip()
    if sender_name:
        return sender_name[:255]
    forward_from = message.get("forward_from") or {}
    full_name = " ".join(
        part
        for part in [
            str(forward_from.get("first_name") or "").strip(),
            str(forward_from.get("last_name") or "").strip(),
        ]
        if part
    ).strip()
    if full_name:
        return full_name[:255]
    forward_chat = message.get("forward_from_chat") or {}
    title = str(forward_chat.get("title") or "").strip()
    return title[:255]


def extract_source_text(message: dict) -> str:
    text = str(message.get("text") or message.get("caption") or "").strip()
    forward_parts: list[str] = []
    sender_name = extract_forward_sender_name(message)
    forward_from = message.get("forward_from") or {}
    forward_chat = message.get("forward_from_chat") or {}
    if sender_name:
        forward_parts.append(sender_name)
    if forward_from:
        full_name = " ".join(
            part
            for part in [
                str(forward_from.get("first_name") or "").strip(),
                str(forward_from.get("last_name") or "").strip(),
            ]
            if part
        ).strip()
        if full_name:
            forward_parts.append(full_name)
    if forward_chat:
        title = str(forward_chat.get("title") or "").strip()
        if title:
            forward_parts.append(title)
    if forward_parts:
        return (
            f"Переслано из: {', '.join(dict.fromkeys(forward_parts))}\n{text}".strip()
        )
    return text


def extract_data(source_text: str, *, forward_sender_name: str = "") -> dict:
    lines = [line.strip() for line in source_text.splitlines() if line.strip()]
    phones = sorted(
        {
            normalized
            for normalized in (
                normalize_phone(item) for item in PHONE_RE.findall(source_text)
            )
            if len(normalized) >= 10
        }
    )
    emails = sorted({mail.lower() for mail in EMAIL_RE.findall(source_text)})
    client_name = ""
    client_match = CLIENT_RE.search(source_text)
    if client_match:
        client_name = client_match.group(1).strip()
    elif lines:
        for line in lines[:5]:
            found = NAME_LINE_RE.search(line)
            if found:
                client_name = found.group(1).strip()
                break
    title = next(
        (line[:120] for line in lines if not line.lower().startswith("переслано из:")),
        "",
    )
    return {
        "phones": phones,
        "emails": emails,
        "client_name": client_name[:255],
        "forward_sender_name": forward_sender_name[:255],
        "title": (title or "Сделка из Telegram")[:255],
    }


def collect_attachments(message: dict) -> list[dict]:
    result: list[dict] = []
    document = message.get("document") or {}
    if document and document.get("file_id"):
        result.append(
            {
                "kind": "document",
                "file_id": str(document.get("file_id")),
                "file_name": str(document.get("file_name") or "").strip(),
                "mime_type": str(document.get("mime_type") or "").strip(),
            }
        )
    photos = message.get("photo") or []
    if isinstance(photos, list) and photos:
        file_id = str((photos[-1] or {}).get("file_id") or "").strip()
        if file_id:
            result.append(
                {
                    "kind": "photo",
                    "file_id": file_id,
                    "file_name": "",
                    "mime_type": "image/jpeg",
                }
            )
    return result


def merge_extracted_data(current: dict, incoming: dict) -> dict:
    phones = sorted(set((current.get("phones") or []) + (incoming.get("phones") or [])))
    emails = sorted(set((current.get("emails") or []) + (incoming.get("emails") or [])))
    name = (
        str(current.get("client_name") or "").strip()
        or str(incoming.get("client_name") or "").strip()
    )
    forward_sender_name = (
        str(current.get("forward_sender_name") or "").strip()
        or str(incoming.get("forward_sender_name") or "").strip()
    )
    title = str(current.get("title") or "").strip()
    if not title or title == "Сделка из Telegram":
        title = str(incoming.get("title") or "").strip() or "Сделка из Telegram"
    return {
        "phones": phones,
        "emails": emails,
        "client_name": name[:255],
        "forward_sender_name": forward_sender_name[:255],
        "awaiting_search_query": bool(
            current.get("awaiting_search_query")
            or incoming.get("awaiting_search_query")
        ),
        "title": title[:255],
    }


def append_to_batch(
    *,
    session,
    inbound,
    source_text,
    attachments,
    message,
    update_id,
    forward_sender_name: str = "",
):
    now = timezone.now()
    ids = list(session.batch_message_ids or [])
    payloads = list(session.batch_payloads or [])
    merged_attachments = list(session.aggregated_attachments or [])
    text = str(session.aggregated_text or "")
    extracted = merge_extracted_data(
        dict(session.extracted_data or {}),
        extract_data(source_text, forward_sender_name=forward_sender_name),
    )
    if inbound.message_id not in ids:
        ids.append(inbound.message_id)
        payloads.append(
            {
                "message_id": inbound.message_id,
                "update_id": int(update_id or 0),
                "text": source_text,
                "attachments": attachments,
                "date": message.get("date"),
            }
        )
        existing_file_ids = {
            str(item.get("file_id") or "") for item in merged_attachments
        }
        for item in attachments:
            fid = str(item.get("file_id") or "")
            if fid and fid not in existing_file_ids:
                merged_attachments.append(item)
                existing_file_ids.add(fid)
        chunk = f"--- Сообщение {inbound.message_id} ---\n{source_text.strip() or '(без текста)'}"
        text = f"{text}\n\n{chunk}".strip() if text else chunk
    session.batch_message_ids = ids
    session.batch_payloads = payloads
    session.aggregated_attachments = merged_attachments
    session.aggregated_text = text
    session.extracted_data = extracted
    session.last_message_at = now
    session.expires_at = now + timedelta(minutes=SESSION_TTL_MINUTES)
    session.batch_timeout_seconds = BATCH_TIMEOUT_SECONDS
    session.state = TelegramDealRoutingSession.State.COLLECTING
    session.decision_prompt_sent_at = None
    session.candidate_deal_ids = []
    session.save(
        update_fields=[
            "batch_message_ids",
            "batch_payloads",
            "aggregated_attachments",
            "aggregated_text",
            "extracted_data",
            "last_message_at",
            "expires_at",
            "batch_timeout_seconds",
            "state",
            "decision_prompt_sent_at",
            "candidate_deal_ids",
            "updated_at",
        ]
    )
