from __future__ import annotations

import email
import html
import imaplib
import re
import secrets
import string
from dataclasses import dataclass
from email.header import decode_header
from io import BytesIO
from typing import Any

from apps.common.drive import ensure_deal_folder, upload_file_to_drive
from apps.notes.models import Note
from django.conf import settings
from django.db import transaction

from .mailcow_client import MailcowClient, MailcowError
from .models import Mailbox, MailboxProcessedMessage

MAILBOX_AUTHOR_NAME = "Почта сделки"


@dataclass
class ParsedAttachment:
    name: str
    mime_type: str
    content: bytes


def generate_mailbox_password() -> str:
    alphabet = string.ascii_letters + string.digits
    return "Mail" + "".join(secrets.choice(alphabet) for _ in range(8))


def extract_quota_left(error_text: str) -> int | None:
    lowered = (error_text or "").lower()
    if (
        "mailbox_quota_left_exceeded" not in lowered
        and "mailbox_quota_exceeded" not in lowered
    ):
        return None
    matches = re.findall(r"\d+", error_text)
    if not matches:
        return None
    try:
        value = int(matches[-1])
    except ValueError:
        return None
    return value if value > 0 else None


def ensure_mailcow_domain(client: MailcowClient, domain: str) -> None:
    try:
        client.ensure_domain(domain)
    except MailcowError as exc:
        lowered = str(exc).lower()
        if "domain" not in lowered or "exist" not in lowered:
            raise


def _imap_login(
    imap: imaplib.IMAP4_SSL, mailbox_email: str, master_user: str, master_pass: str
) -> None:
    if "@" in master_user:
        master_login = master_user
    else:
        master_login = f"{master_user}@mailcow.local"
    try:
        imap.login(f"{mailbox_email}*{master_login}", master_pass)
        return
    except imaplib.IMAP4.error:
        imap.login(f"{master_login}*{mailbox_email}", master_pass)


def _decode_header_value(raw_value: str | None) -> str:
    if not raw_value:
        return ""

    decoded_parts: list[str] = []
    for value, charset in decode_header(raw_value):
        if isinstance(value, bytes):
            encoding = charset or "utf-8"
            try:
                decoded_parts.append(value.decode(encoding, errors="replace"))
            except LookupError:
                decoded_parts.append(value.decode("utf-8", errors="replace"))
        else:
            decoded_parts.append(value)
    return "".join(decoded_parts).strip()


def _decode_bytes(value: bytes, charset: str | None = None) -> str:
    encodings = [charset, "utf-8", "cp1251", "latin-1"]
    for encoding in encodings:
        if not encoding:
            continue
        try:
            return value.decode(encoding)
        except (LookupError, UnicodeDecodeError):
            continue
    return value.decode("utf-8", errors="replace")


def _extract_text_from_html(html_value: str) -> str:
    text = re.sub(r"<style[\s\S]*?</style>", " ", html_value, flags=re.IGNORECASE)
    text = re.sub(r"<script[\s\S]*?</script>", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    text = html.unescape(text)
    return " ".join(text.split())


def _normalize_text(text: str) -> str:
    return "\n".join(line.strip() for line in text.splitlines()).strip()


def _safe_attachment_name(raw_name: str | None, index: int) -> str:
    decoded = _decode_header_value(raw_name)
    normalized = decoded.strip()
    if normalized:
        return normalized
    return f"attachment_{index}"


def _extract_email_payload(
    message: email.message.Message,
) -> tuple[str, list[ParsedAttachment]]:
    plain_parts: list[str] = []
    html_parts: list[str] = []
    attachments: list[ParsedAttachment] = []

    for index, part in enumerate(message.walk(), start=1):
        if part.is_multipart():
            continue

        content_type = part.get_content_type() or "application/octet-stream"
        content_disposition = (part.get_content_disposition() or "").lower()
        filename = part.get_filename()
        payload = part.get_payload(decode=True) or b""

        is_attachment = content_disposition == "attachment" or bool(filename)
        if is_attachment:
            attachments.append(
                ParsedAttachment(
                    name=_safe_attachment_name(filename, index),
                    mime_type=content_type,
                    content=payload,
                )
            )
            continue

        if content_type == "text/plain":
            plain_parts.append(_decode_bytes(payload, part.get_content_charset()))
        elif content_type == "text/html":
            html_parts.append(_decode_bytes(payload, part.get_content_charset()))

    body_text = "\n\n".join(
        _normalize_text(part) for part in plain_parts if part.strip()
    )
    if not body_text:
        html_text = "\n\n".join(part for part in html_parts if part.strip())
        body_text = _extract_text_from_html(html_text)

    body_text = _normalize_text(body_text)
    return body_text, attachments


def _format_note_body(
    subject: str, sender: str, date_value: str, body_text: str
) -> str:
    lines = [
        "Письмо из почты сделки",
        f"Тема: {subject or '-'}",
        f"От: {sender or '-'}",
        f"Дата: {date_value or '-'}",
    ]
    if body_text:
        lines.extend(["", body_text])
    return "\n".join(lines).strip()


def _mailbox_base_local_part(client_name: str) -> str:
    translit_map = {
        "а": "a",
        "б": "b",
        "в": "v",
        "г": "g",
        "д": "d",
        "е": "e",
        "ё": "e",
        "ж": "zh",
        "з": "z",
        "и": "i",
        "й": "y",
        "к": "k",
        "л": "l",
        "м": "m",
        "н": "n",
        "о": "o",
        "п": "p",
        "р": "r",
        "с": "s",
        "т": "t",
        "у": "u",
        "ф": "f",
        "х": "h",
        "ц": "ts",
        "ч": "ch",
        "ш": "sh",
        "щ": "sch",
        "ъ": "",
        "ы": "y",
        "ь": "",
        "э": "e",
        "ю": "yu",
        "я": "ya",
    }

    normalized = (client_name or "").strip().lower()
    result_parts: list[str] = []
    for char in normalized:
        if char in translit_map:
            result_parts.append(translit_map[char])
            continue
        if re.fullmatch(r"[a-z0-9]", char):
            result_parts.append(char)
            continue
        if char in {".", "_", "-"}:
            result_parts.append(char)
            continue
        result_parts.append("_")

    value = "".join(result_parts)
    value = re.sub(r"_+", "_", value)
    value = re.sub(r"\.+", ".", value)
    value = re.sub(r"-+", "-", value)
    value = value.strip("._-")
    return value or "deal"


def build_mailbox_local_part(client_name: str, domain: str) -> str:
    base = _mailbox_base_local_part(client_name)

    index = 0
    while True:
        candidate = base if index == 0 else f"{base}_{index}"
        email_address = f"{candidate}@{domain}".lower()
        if not Mailbox.objects.filter(email=email_address).exists():
            return candidate
        index += 1


def process_mailbox_messages(mailbox: Mailbox) -> dict[str, int]:
    host = getattr(settings, "MAILCOW_IMAP_HOST", "")
    port = int(getattr(settings, "MAILCOW_IMAP_PORT", 993))
    master_user = getattr(settings, "MAILCOW_IMAP_MASTER_USER", "")
    master_pass = getattr(settings, "MAILCOW_IMAP_MASTER_PASS", "")
    if not host or not master_user or not master_pass:
        raise MailcowError("MAILCOW IMAP is not configured.")

    deal = mailbox.deal
    if not deal:
        raise MailcowError("Ящик не привязан к сделке.")

    folder_id = deal.drive_folder_id or ensure_deal_folder(deal)
    if not folder_id:
        raise MailcowError("Не удалось получить папку сделки в Google Drive.")

    processed = 0
    skipped = 0
    failed = 0
    deleted = 0

    with imaplib.IMAP4_SSL(host, port) as imap:
        _imap_login(imap, mailbox.email, master_user, master_pass)
        select_status, _ = imap.select("INBOX")
        if select_status != "OK":
            raise MailcowError("Не удалось открыть INBOX.")

        search_status, search_data = imap.uid("search", None, "ALL")
        if search_status != "OK" or not search_data:
            return {"processed": 0, "skipped": 0, "failed": 0, "deleted": 0}

        raw_uids = search_data[0].split()
        uids = [uid.decode("utf-8") for uid in raw_uids if uid]

        for uid in reversed(uids):
            try:
                if MailboxProcessedMessage.objects.filter(
                    mailbox=mailbox, uid=uid
                ).exists():
                    skipped += 1
                    delete_status, _ = imap.uid("store", uid, "+FLAGS", "(\\Deleted)")
                    if delete_status == "OK":
                        deleted += 1
                    continue

                fetch_status, fetch_data = imap.uid("fetch", uid, "(RFC822)")
                if fetch_status != "OK" or not fetch_data:
                    failed += 1
                    continue

                raw_message = b""
                for chunk in fetch_data:
                    if isinstance(chunk, tuple):
                        raw_message += chunk[1]

                message = email.message_from_bytes(raw_message)
                message_id = _decode_header_value(message.get("Message-ID"))

                if (
                    message_id
                    and MailboxProcessedMessage.objects.filter(
                        mailbox=mailbox, message_id=message_id
                    ).exists()
                ):
                    skipped += 1
                    delete_status, _ = imap.uid("store", uid, "+FLAGS", "(\\Deleted)")
                    if delete_status == "OK":
                        deleted += 1
                    continue

                subject = _decode_header_value(message.get("Subject"))
                sender = _decode_header_value(message.get("From"))
                date_value = _decode_header_value(message.get("Date"))
                body_text, attachments = _extract_email_payload(message)

                note_attachments = []
                for attachment in attachments:
                    uploaded = upload_file_to_drive(
                        folder_id=folder_id,
                        file_obj=BytesIO(attachment.content),
                        file_name=attachment.name,
                        mime_type=attachment.mime_type,
                    )
                    note_attachments.append(
                        {
                            "id": uploaded["id"],
                            "name": uploaded["name"],
                            "mime_type": uploaded["mime_type"],
                            "size": uploaded["size"],
                            "web_view_link": uploaded["web_view_link"],
                        }
                    )

                note_body = _format_note_body(subject, sender, date_value, body_text)

                with transaction.atomic():
                    Note.objects.create(
                        deal=deal,
                        body=note_body,
                        author_name=MAILBOX_AUTHOR_NAME,
                        attachments=note_attachments,
                    )
                    MailboxProcessedMessage.objects.create(
                        mailbox=mailbox,
                        uid=uid,
                        message_id=message_id,
                        subject=subject,
                        sender=sender,
                    )

                processed += 1
                delete_status, _ = imap.uid("store", uid, "+FLAGS", "(\\Deleted)")
                if delete_status == "OK":
                    deleted += 1
            except Exception:
                failed += 1

        if deleted > 0:
            imap.expunge()

    return {
        "processed": processed,
        "skipped": skipped,
        "failed": failed,
        "deleted": deleted,
    }


def fetch_mailbox_messages(mailbox_email: str, limit: int) -> list[dict[str, Any]]:
    host = getattr(settings, "MAILCOW_IMAP_HOST", "")
    port = int(getattr(settings, "MAILCOW_IMAP_PORT", 993))
    master_user = getattr(settings, "MAILCOW_IMAP_MASTER_USER", "")
    master_pass = getattr(settings, "MAILCOW_IMAP_MASTER_PASS", "")
    if not host or not master_user or not master_pass:
        raise MailcowError("MAILCOW IMAP is not configured.")

    with imaplib.IMAP4_SSL(host, port) as imap:
        _imap_login(imap, mailbox_email, master_user, master_pass)
        imap.select("INBOX", readonly=True)
        status_code, data = imap.search(None, "ALL")
        if status_code != "OK" or not data:
            return []
        ids = data[0].split()
        selected_ids = ids[-limit:]
        messages: list[dict[str, Any]] = []
        for msg_id in reversed(selected_ids):
            status_code, msg_data = imap.fetch(msg_id, "(RFC822)")
            if status_code != "OK" or not msg_data:
                continue
            raw = b""
            for part in msg_data:
                if isinstance(part, tuple):
                    raw += part[1]
            message = email.message_from_bytes(raw)
            subject = _decode_header_value(message.get("Subject"))
            sender = _decode_header_value(message.get("From"))
            date_value = _decode_header_value(message.get("Date"))
            body_text, _ = _extract_email_payload(message)
            snippet = " ".join(body_text.strip().split())[:240]
            messages.append(
                {
                    "id": msg_id.decode("utf-8"),
                    "subject": subject,
                    "from": sender,
                    "date": date_value,
                    "snippet": snippet,
                }
            )
        return messages
