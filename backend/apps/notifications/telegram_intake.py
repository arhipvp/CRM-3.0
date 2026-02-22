import base64
import json
import logging
import mimetypes
import re
import socket
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import timedelta
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
from apps.deals.permissions import is_admin_user
from apps.documents.models import Document
from apps.notes.models import Note
from django.conf import settings
from django.core.files.base import ContentFile
from django.db.models import Q
from django.utils import timezone

from .models import TelegramDealRoutingSession, TelegramInboundMessage

logger = logging.getLogger(__name__)

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
CALLBACK_PREFIX = "tgintake"
SESSION_TTL_MINUTES = 30
BATCH_TIMEOUT_SECONDS = 60


@dataclass
class IntakeResult:
    text: str
    reply_markup: dict | None = None
    already_sent: bool = False


def _build_deal_link(deal_id: str | int | None) -> str:
    if not deal_id:
        return ""
    base_url = getattr(settings, "CRM_PUBLIC_URL", "").strip().rstrip("/")
    if not base_url:
        return ""
    return f"{base_url}/deals?dealId={deal_id}"


def _normalize_phone(value: str) -> str:
    digits = "".join(ch for ch in (value or "") if ch.isdigit())
    if len(digits) == 11 and digits.startswith("8"):
        digits = "7" + digits[1:]
    return digits


def _extract_source_text(message: dict) -> str:
    text = str(message.get("text") or message.get("caption") or "").strip()
    forward_parts: list[str] = []
    sender_name = _extract_forward_sender_name(message)
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


def _extract_forward_sender_name(message: dict) -> str:
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


def _extract_data(source_text: str, *, forward_sender_name: str = "") -> dict:
    lines = [line.strip() for line in source_text.splitlines() if line.strip()]
    phones = sorted(
        {
            normalized
            for normalized in (
                _normalize_phone(item) for item in PHONE_RE.findall(source_text)
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


def _collect_attachments(message: dict) -> list[dict]:
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


class TelegramIntakeService:
    def __init__(self, client) -> None:
        self.client = client

    def build_help_message(self) -> str:
        return (
            "Команды Telegram intake:\n"
            "/help - справка\n"
            "/pick <номер> - выбрать сделку\n"
            "/find <текст> - найти сделку по названию/клиенту\n"
            "/create - создать сделку\n"
            "/send_now - завершить сбор пакета сейчас\n"
            "/force_send - алиас для /send_now\n"
            "/cancel - отменить пакет\n\n"
            "Отправьте документы подряд: бот объединит их в пакет и через 60 секунд предложит действие."
        )

    def expire_stale_sessions(self, user=None) -> int:
        states = [
            TelegramDealRoutingSession.State.COLLECTING,
            TelegramDealRoutingSession.State.READY,
            TelegramDealRoutingSession.State.PENDING,
        ]
        qs = TelegramDealRoutingSession.objects.filter(
            state__in=states, expires_at__lte=timezone.now()
        )
        if user is not None:
            qs = qs.filter(user=user)
        ids = list(qs.values_list("id", flat=True))
        if not ids:
            return 0
        for session in TelegramDealRoutingSession.objects.filter(id__in=ids):
            session.state = TelegramDealRoutingSession.State.EXPIRED
            session.save(update_fields=["state", "updated_at"])
            TelegramInboundMessage.objects.filter(routing_session=session).update(
                status=TelegramInboundMessage.Status.EXPIRED,
                processed_at=timezone.now(),
            )
        return len(ids)

    def finalize_ready_batches(self) -> int:
        self.expire_stale_sessions()
        now = timezone.now()
        count = 0
        qs = TelegramDealRoutingSession.objects.filter(
            state__in=[
                TelegramDealRoutingSession.State.COLLECTING,
                TelegramDealRoutingSession.State.PENDING,
            ],
            decision_prompt_sent_at__isnull=True,
        ).select_related("user")
        for session in qs:
            if not session.last_message_at:
                continue
            timeout = max(
                int(session.batch_timeout_seconds or BATCH_TIMEOUT_SECONDS), 1
            )
            if now < session.last_message_at + timedelta(seconds=timeout):
                continue
            text, markup = self._prepare_ready_prompt(session=session, now=now)
            count += 1
            profile = getattr(session.user, "telegram_profile", None)
            chat_id = getattr(profile, "chat_id", None)
            if not chat_id:
                continue
            self._send_or_update_session_message(
                chat_id=int(chat_id),
                session=session,
                text=text,
                reply_markup=markup,
            )
        return count

    def process_message(
        self, *, user, update_id: int, chat_id: int, message: dict
    ) -> IntakeResult:
        self.expire_stale_sessions(user=user)
        message_id = int(message.get("message_id") or 0)
        source_text = _extract_source_text(message)
        forward_sender_name = _extract_forward_sender_name(message)
        attachments = _collect_attachments(message)

        active_session = self._get_latest_non_final_session(user)
        if (
            active_session
            and self._is_search_mode(active_session)
            and source_text
            and not attachments
        ):
            return self._process_find_for_session(
                user=user,
                query=source_text,
                session=active_session,
            )

        inbound, created = TelegramInboundMessage.objects.get_or_create(
            chat_id=chat_id,
            message_id=message_id,
            defaults={
                "user": user,
                "update_id": int(update_id or 0),
                "text": source_text,
                "payload": message,
                "status": TelegramInboundMessage.Status.RECEIVED,
            },
        )
        if not created and inbound.user_id != user.id:
            return IntakeResult(
                "Это сообщение уже обработано в другом профиле пользователя."
            )
        if not created and inbound.routing_session_id:
            session = inbound.routing_session
            if session and session.state in {
                TelegramDealRoutingSession.State.COLLECTING,
                TelegramDealRoutingSession.State.PENDING,
                TelegramDealRoutingSession.State.READY,
            }:
                files_count = len(session.aggregated_attachments or [])
                return IntakeResult(
                    "Это сообщение уже добавлено в текущий пакет."
                    f"\nСообщений: {len(session.batch_message_ids or [])}, файлов: {files_count}."
                )
        if not created and inbound.processed_at:
            link = _build_deal_link(getattr(inbound.linked_deal, "id", None))
            return IntakeResult(
                f"Это сообщение уже обработано (статус: {inbound.status})."
                + (f"\nСделка: {link}" if link else "")
            )

        session = self._get_collecting_session(user)
        if session and session.is_expired:
            session = None
        now = timezone.now()
        if not session:
            session = TelegramDealRoutingSession.objects.create(
                user=user,
                state=TelegramDealRoutingSession.State.COLLECTING,
                expires_at=now + timedelta(minutes=SESSION_TTL_MINUTES),
                last_message_at=now,
                batch_timeout_seconds=BATCH_TIMEOUT_SECONDS,
                batch_message_ids=[],
                batch_payloads=[],
                aggregated_text="",
                aggregated_attachments=[],
                extracted_data={},
                candidate_deal_ids=[],
            )
        self._append_to_batch(
            session,
            inbound,
            source_text,
            attachments,
            message,
            update_id,
            forward_sender_name=forward_sender_name,
        )
        inbound.user = user
        inbound.status = TelegramInboundMessage.Status.WAITING_DECISION
        inbound.routing_session = session
        inbound.update_id = int(update_id or 0)
        inbound.text = source_text
        inbound.payload = message
        inbound.save(
            update_fields=[
                "user",
                "status",
                "routing_session",
                "update_id",
                "text",
                "payload",
                "updated_at",
            ]
        )
        status_text = (
            f"Добавлено в пакет: сообщений {len(session.batch_message_ids or [])}, файлов {len(session.aggregated_attachments or [])}.\n"
            "Отправьте ещё или подождите 60 сек для предложения выбора сделки."
        )
        self._send_or_update_session_message(
            chat_id=chat_id,
            session=session,
            text=status_text,
            reply_markup=self._build_collecting_keyboard(session),
        )
        return IntakeResult(status_text, already_sent=True)

    def process_send_now(
        self, *, user, session: TelegramDealRoutingSession | None = None
    ) -> IntakeResult:
        self.expire_stale_sessions(user=user)

        ready = (
            session
            if session and session.state == TelegramDealRoutingSession.State.READY
            else self._get_ready_session(user)
        )
        if ready:
            return IntakeResult(
                "Пакет уже готов. Используйте /pick, /find, /create или /cancel."
            )

        session = session or self._get_collecting_session(user)
        if not session:
            if self._get_latest_expired_session(user):
                return IntakeResult(
                    "Сессия выбора истекла. Перешлите сообщение заново."
                )
            return IntakeResult("Нет активного пакета для отправки.")

        if not session.batch_message_ids:
            return IntakeResult("Текущий пакет пуст. Отправьте хотя бы одно сообщение.")

        profile = getattr(user, "telegram_profile", None)
        chat_id = getattr(profile, "chat_id", None)
        if not chat_id:
            return IntakeResult("Telegram не привязан. Выполните /start <код>.")

        text, markup = self._prepare_ready_prompt(session=session, now=timezone.now())
        self._send_or_update_session_message(
            chat_id=int(chat_id),
            session=session,
            text=text,
            reply_markup=markup,
        )
        return IntakeResult(text, reply_markup=markup, already_sent=True)

    def process_find(self, *, user, query: str) -> IntakeResult:
        self.expire_stale_sessions(user=user)
        normalized_query = str(query or "").strip()
        if not normalized_query:
            return IntakeResult("Используйте формат: /find <текст>")

        session = self._get_latest_non_final_session(user)
        return self._process_find_for_session(
            user=user, query=normalized_query, session=session
        )

    def process_request_find(
        self, *, user, session: TelegramDealRoutingSession | None = None
    ) -> IntakeResult:
        self.expire_stale_sessions(user=user)
        session = session or self._get_latest_non_final_session(user)
        if not session:
            if self._get_latest_expired_session(user):
                return IntakeResult(
                    "Сессия выбора истекла. Перешлите сообщение заново."
                )
            return IntakeResult("Нет активного выбора. Перешлите сообщение заново.")
        if not session.batch_message_ids:
            return IntakeResult("Текущий пакет пуст. Отправьте хотя бы одно сообщение.")
        self._set_search_mode(session, enabled=True)
        return IntakeResult(
            "Введите текст для поиска сделки (например, ФИО клиента или название).\n"
            "Я покажу подходящие сделки кнопками.",
            reply_markup=self._build_search_keyboard(session),
        )

    def _process_find_for_session(
        self, *, user, query: str, session: TelegramDealRoutingSession | None
    ) -> IntakeResult:
        normalized_query = str(query or "").strip()
        if not normalized_query:
            return IntakeResult("Используйте формат: /find <текст>")
        if not session:
            if self._get_latest_expired_session(user):
                return IntakeResult(
                    "Сессия выбора истекла. Перешлите сообщение заново."
                )
            return IntakeResult("Нет активного выбора. Перешлите сообщение заново.")
        if not session.batch_message_ids:
            return IntakeResult("Текущий пакет пуст. Отправьте хотя бы одно сообщение.")
        self._set_search_mode(session, enabled=False)

        results = self._search_deals_by_query(user=user, query=normalized_query)
        session.candidate_deal_ids = [str(item.id) for item in results]
        if session.state in {
            TelegramDealRoutingSession.State.COLLECTING,
            TelegramDealRoutingSession.State.PENDING,
        }:
            session.state = TelegramDealRoutingSession.State.READY
        if session.decision_prompt_sent_at is None:
            session.decision_prompt_sent_at = timezone.now()
        session.save(
            update_fields=[
                "candidate_deal_ids",
                "state",
                "decision_prompt_sent_at",
                "updated_at",
            ]
        )

        if not results:
            return IntakeResult(
                f"По запросу «{normalized_query}» ничего не найдено.\n"
                "Нажмите «Поиск сделки», чтобы попробовать другой запрос, или создайте новую сделку.",
                reply_markup=self._build_search_empty_keyboard(session),
            )

        lines = [
            f"Результаты поиска по запросу «{normalized_query}»:",
            "Выберите сделку кнопкой ниже:",
        ]
        for idx, deal in enumerate(results, start=1):
            client_name = getattr(getattr(deal, "client", None), "name", "")
            lines.append(
                f"{idx}. {deal.title} (клиент: {client_name}, статус: {deal.status})"
            )
        lines.append("")
        lines.append(
            "Если не нашли нужное, нажмите «Поиск сделки» или «Создать новую сделку»."
        )
        return IntakeResult(
            "\n".join(lines),
            reply_markup=self._build_candidates_keyboard(session, results),
        )

    def process_pick(
        self,
        *,
        user,
        pick_index: int,
        session: TelegramDealRoutingSession | None = None,
    ) -> IntakeResult:
        self.expire_stale_sessions(user=user)
        session = session or self._get_ready_session(user)
        if not session:
            if self._get_latest_expired_session(user):
                return IntakeResult(
                    "Сессия выбора истекла. Перешлите сообщение заново."
                )
            if self._get_collecting_session(user):
                return IntakeResult(
                    "Пакет ещё собирается. Подождите 60 сек после последнего сообщения."
                )
            return IntakeResult("Нет активного выбора. Перешлите сообщение заново.")
        if session.state != TelegramDealRoutingSession.State.READY:
            return IntakeResult("Этот пакет ещё не готов к выбору сделки.")
        candidate_ids = [str(item) for item in (session.candidate_deal_ids or [])]
        if not candidate_ids:
            # Backward-compatible fallback: allow /pick by index even when
            # auto-matching produced no candidates in READY state.
            fallback_candidates = list(
                self._deal_queryset_for_user(user).order_by(
                    "status", "-updated_at", "-created_at"
                )[:5]
            )
            candidate_ids = [str(item.id) for item in fallback_candidates]
        if pick_index < 1 or pick_index > len(candidate_ids):
            return IntakeResult("Некорректный номер сделки. Используйте /pick <номер>.")
        deal = (
            self._deal_queryset_for_user(user)
            .filter(id=candidate_ids[pick_index - 1])
            .first()
        )
        if not deal:
            return IntakeResult("Сделка недоступна или не найдена.")
        saved, failed, failure_hint = self._attach_batch_to_deal(
            user=user,
            session=session,
            deal=deal,
            final_status=TelegramInboundMessage.Status.LINKED_EXISTING,
        )
        session.state = TelegramDealRoutingSession.State.LINKED_EXISTING
        session.selected_deal = deal
        session.save(update_fields=["state", "selected_deal", "updated_at"])
        link = _build_deal_link(deal.id)
        failure_text = ""
        if failed:
            failure_text = f"\nОшибки файлов: {failed}"
            if failure_hint:
                failure_text += f" ({failure_hint})"
        return IntakeResult(
            f"Пакет привязан к сделке '{deal.title}'.\nСохранено файлов: {saved}."
            + failure_text
            + (f"\nСделка: {link}" if link else "")
        )

    def process_create(
        self, *, user, session: TelegramDealRoutingSession | None = None
    ) -> IntakeResult:
        self.expire_stale_sessions(user=user)
        session = session or self._get_ready_session(user)
        if not session:
            if self._get_latest_expired_session(user):
                return IntakeResult(
                    "Сессия выбора истекла. Перешлите сообщение заново."
                )
            if self._get_collecting_session(user):
                return IntakeResult(
                    "Пакет ещё собирается. Подождите 60 сек после последнего сообщения."
                )
            return IntakeResult("Нет активного выбора. Перешлите сообщение заново.")
        if session.state != TelegramDealRoutingSession.State.READY:
            return IntakeResult("Этот пакет ещё не готов к созданию сделки.")
        extracted = session.extracted_data or {}
        client = self._find_or_create_client(user=user, extracted_data=extracted)
        deal = Deal.objects.create(
            title=(
                str(extracted.get("title") or "Сделка из Telegram").strip()[:255]
                or "Сделка из Telegram"
            ),
            client=client,
            seller=user,
            status=Deal.DealStatus.OPEN,
            source="telegram",
        )
        saved, failed, failure_hint = self._attach_batch_to_deal(
            user=user,
            session=session,
            deal=deal,
            final_status=TelegramInboundMessage.Status.CREATED_NEW_DEAL,
        )
        session.state = TelegramDealRoutingSession.State.CREATED_NEW_DEAL
        session.created_client = client
        session.created_deal = deal
        session.selected_deal = deal
        session.save(
            update_fields=[
                "state",
                "created_client",
                "created_deal",
                "selected_deal",
                "updated_at",
            ]
        )
        link = _build_deal_link(deal.id)
        failure_text = ""
        if failed:
            failure_text = f"\nОшибки файлов: {failed}"
            if failure_hint:
                failure_text += f" ({failure_hint})"
        return IntakeResult(
            f"Создана новая сделка '{deal.title}' для клиента '{client.name}'.\nСохранено файлов: {saved}."
            + failure_text
            + (f"\nСделка: {link}" if link else "")
        )

    def process_cancel(
        self, *, user, session: TelegramDealRoutingSession | None = None
    ) -> IntakeResult:
        self.expire_stale_sessions(user=user)
        session = session or self._get_latest_non_final_session(user)
        if not session:
            return IntakeResult("Нет активной сессии.")
        session.state = TelegramDealRoutingSession.State.CANCELED
        session.save(update_fields=["state", "updated_at"])
        TelegramInboundMessage.objects.filter(routing_session=session).update(
            status=TelegramInboundMessage.Status.CANCELED,
            processed_at=timezone.now(),
        )
        return IntakeResult("Текущий пакет отменён. Можете отправить новые документы.")

    def parse_callback(self, data: str) -> dict | None:
        if not data or not data.startswith(f"{CALLBACK_PREFIX}:"):
            return None
        parts = data.split(":")
        if len(parts) < 3:
            return None
        action = parts[1]
        try:
            sid = int(parts[2])
        except (TypeError, ValueError):
            return None
        value = parts[3] if len(parts) > 3 else None
        return {"action": action, "session_id": sid, "value": value}

    def process_callback(self, *, user, callback_data: str) -> IntakeResult:
        parsed = self.parse_callback(callback_data)
        if not parsed:
            return IntakeResult("Неизвестная команда кнопки.")
        action = parsed["action"]
        sid = parsed["session_id"]
        value = parsed.get("value")
        session = TelegramDealRoutingSession.objects.filter(id=sid, user=user).first()
        if not session:
            return IntakeResult("Сессия не найдена.")
        if action == "pick":
            if not value:
                return IntakeResult("Сделка для выбора не указана.")
            deal_id = str(value)
            candidate_ids = [str(item) for item in (session.candidate_deal_ids or [])]
            if deal_id not in candidate_ids:
                return IntakeResult(
                    "Список сделок устарел. Выполните поиск заново или нажмите «Поиск сделки»."
                )
            pick_index = candidate_ids.index(deal_id) + 1
            return self.process_pick(user=user, pick_index=pick_index, session=session)
        if action == "search":
            return self.process_request_find(user=user, session=session)
        if action == "send_now":
            return self.process_send_now(user=user, session=session)
        if action == "create":
            return self.process_create(user=user, session=session)
        if action == "cancel":
            return self.process_cancel(user=user, session=session)
        return IntakeResult("Неизвестное действие.")

    def _append_to_batch(
        self,
        session,
        inbound,
        source_text,
        attachments,
        message,
        update_id,
        *,
        forward_sender_name: str = "",
    ):
        now = timezone.now()
        ids = list(session.batch_message_ids or [])
        payloads = list(session.batch_payloads or [])
        merged_attachments = list(session.aggregated_attachments or [])
        text = str(session.aggregated_text or "")
        extracted = self._merge_extracted_data(
            dict(session.extracted_data or {}),
            _extract_data(source_text, forward_sender_name=forward_sender_name),
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

    def _send_or_update_session_message(
        self,
        *,
        chat_id: int,
        session,
        text: str,
        reply_markup: dict | None = None,
    ) -> None:
        status_message_id = session.status_message_id
        if status_message_id:
            edited = self.client.edit_message_text(
                chat_id=chat_id,
                message_id=int(status_message_id),
                text=text,
                reply_markup=reply_markup,
            )
            if edited:
                return
        sent_message_id = self.client.send_message(
            chat_id,
            text,
            reply_markup=reply_markup,
        )
        if sent_message_id:
            session.status_message_id = int(sent_message_id)
            session.save(update_fields=["status_message_id", "updated_at"])

    def _merge_extracted_data(self, current: dict, incoming: dict) -> dict:
        phones = sorted(
            set((current.get("phones") or []) + (incoming.get("phones") or []))
        )
        emails = sorted(
            set((current.get("emails") or []) + (incoming.get("emails") or []))
        )
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

    def _deal_queryset_for_user(self, user):
        qs = Deal.objects.alive().select_related("client")
        if is_admin_user(user):
            return qs
        return qs.filter(
            Q(seller=user) | Q(executor=user) | Q(visible_users=user)
        ).distinct()

    def _find_candidate_deals(self, *, user, extracted_data: dict) -> list[Deal]:
        phones = extracted_data.get("phones") or []
        emails = extracted_data.get("emails") or []
        name = str(extracted_data.get("client_name") or "").strip().lower()
        if not phones and not emails and not name:
            return []
        scored: list[tuple[int, Deal]] = []
        for deal in self._deal_queryset_for_user(user):
            client = getattr(deal, "client", None)
            if not client:
                continue
            score = 0
            cphone = _normalize_phone(getattr(client, "phone", ""))
            cemail = str(getattr(client, "email", "") or "").strip().lower()
            cname = str(getattr(client, "name", "") or "").strip().lower()
            for phone in phones:
                if cphone and phone == cphone:
                    score += 8
                elif cphone and len(phone) >= 10 and phone[-10:] == cphone[-10:]:
                    score += 6
            for email in emails:
                if cemail and email == cemail:
                    score += 8
            if name and cname:
                score += 2 * sum(
                    1 for token in re.split(r"\s+", name) if token and token in cname
                )
            if score <= 0:
                continue
            if deal.status == Deal.DealStatus.OPEN:
                score += 2
            elif deal.status == Deal.DealStatus.ON_HOLD:
                score += 1
            scored.append((score, deal))
        scored.sort(
            key=lambda item: (
                -item[0],
                item[1].status != Deal.DealStatus.OPEN,
                -int(item[1].created_at.timestamp()),
            )
        )
        return [deal for _, deal in scored[:5]]

    def _search_deals_by_query(self, *, user, query: str) -> list[Deal]:
        normalized_query = str(query or "").strip()
        if not normalized_query:
            return []
        return list(
            self._deal_queryset_for_user(user)
            .filter(
                Q(title__icontains=normalized_query)
                | Q(client__name__icontains=normalized_query)
            )
            .order_by("-created_at")[:5]
        )

    def _find_forward_name_deals(self, *, user, forward_sender_name: str) -> list[Deal]:
        raw_name = str(forward_sender_name or "").strip().lower()
        tokens = [token for token in NAME_TOKEN_RE.findall(raw_name) if len(token) >= 2]
        unique_tokens: list[str] = []
        for token in tokens:
            if token not in unique_tokens:
                unique_tokens.append(token)
        if len(unique_tokens) < 2:
            return []
        matches: list[Deal] = []
        for deal in self._deal_queryset_for_user(user):
            client_name = str(
                getattr(getattr(deal, "client", None), "name", "")
            ).lower()
            if client_name and all(token in client_name for token in unique_tokens):
                matches.append(deal)
        matches.sort(
            key=lambda item: (
                item.status != Deal.DealStatus.OPEN,
                -int(item.created_at.timestamp()),
            )
        )
        return matches[:5]

    def _build_candidates_message(
        self, candidates, session, *, forward_match_count: int = 0
    ):
        lines = [
            f"Пакет готов: сообщений {len(session.batch_message_ids or [])}, файлов {len(session.aggregated_attachments or [])}.",
        ]
        if forward_match_count > 0:
            lines.append("Найдено по ФИО из переслано от… Выберите номер сделки:")
        else:
            lines.append("Найдены подходящие сделки. Выберите номер:")
        for idx, deal in enumerate(candidates, start=1):
            cname = getattr(getattr(deal, "client", None), "name", "")
            lines.append(
                f"{idx}. {deal.title} (клиент: {cname}, статус: {deal.status})"
            )
        lines.append("")
        lines.append(
            "Выберите нужную сделку кнопкой ниже. Для другого запроса нажмите «Поиск сделки»."
        )
        return "\n".join(lines)

    def _build_candidates_keyboard(self, session, candidates):
        rows = []
        for deal in candidates:
            client_name = str(
                getattr(getattr(deal, "client", None), "name", "")
            ).strip()
            deal_title = str(deal.title or "").strip()
            button_text = deal_title[:48] if deal_title else "Сделка"
            if client_name:
                button_text = f"{button_text} ({client_name[:24]})"
            rows.append(
                [
                    {
                        "text": button_text,
                        "callback_data": f"{CALLBACK_PREFIX}:pick:{session.id}:{deal.id}",
                    }
                ]
            )
        rows.append(
            [
                {
                    "text": "Поиск сделки",
                    "callback_data": f"{CALLBACK_PREFIX}:search:{session.id}",
                },
                {
                    "text": "Создать новую сделку",
                    "callback_data": f"{CALLBACK_PREFIX}:create:{session.id}",
                },
                {
                    "text": "Отмена",
                    "callback_data": f"{CALLBACK_PREFIX}:cancel:{session.id}",
                },
            ]
        )
        return {"inline_keyboard": rows}

    def _build_collecting_keyboard(self, session):
        return {
            "inline_keyboard": [
                [
                    {
                        "text": "Отправить немедленно",
                        "callback_data": f"{CALLBACK_PREFIX}:send_now:{session.id}",
                    },
                    {
                        "text": "Отмена",
                        "callback_data": f"{CALLBACK_PREFIX}:cancel:{session.id}",
                    },
                ]
            ]
        }

    def _build_create_only_keyboard(self, session):
        return {
            "inline_keyboard": [
                [
                    {
                        "text": "Поиск сделки",
                        "callback_data": f"{CALLBACK_PREFIX}:search:{session.id}",
                    },
                    {
                        "text": "Создать сделку",
                        "callback_data": f"{CALLBACK_PREFIX}:create:{session.id}",
                    },
                    {
                        "text": "Отмена",
                        "callback_data": f"{CALLBACK_PREFIX}:cancel:{session.id}",
                    },
                ]
            ]
        }

    def _build_search_keyboard(self, session):
        return {
            "inline_keyboard": [
                [
                    {
                        "text": "Отмена",
                        "callback_data": f"{CALLBACK_PREFIX}:cancel:{session.id}",
                    }
                ]
            ]
        }

    def _build_search_empty_keyboard(self, session):
        return {
            "inline_keyboard": [
                [
                    {
                        "text": "Поиск сделки",
                        "callback_data": f"{CALLBACK_PREFIX}:search:{session.id}",
                    },
                    {
                        "text": "Создать новую сделку",
                        "callback_data": f"{CALLBACK_PREFIX}:create:{session.id}",
                    },
                ],
                [
                    {
                        "text": "Отмена",
                        "callback_data": f"{CALLBACK_PREFIX}:cancel:{session.id}",
                    }
                ],
            ]
        }

    def _prepare_ready_prompt(self, *, session, now):
        extracted = session.extracted_data or {}
        forward_sender_name = str(extracted.get("forward_sender_name") or "").strip()
        forward_matches = self._find_forward_name_deals(
            user=session.user,
            forward_sender_name=forward_sender_name,
        )
        scored_candidates = self._find_candidate_deals(
            user=session.user,
            extracted_data=extracted,
        )
        candidates: list[Deal] = []
        seen_ids: set[str] = set()
        for deal in [*forward_matches, *scored_candidates]:
            sid = str(deal.id)
            if sid in seen_ids:
                continue
            seen_ids.add(sid)
            candidates.append(deal)
            if len(candidates) >= 5:
                break
        session.candidate_deal_ids = [str(item.id) for item in candidates]
        session.state = TelegramDealRoutingSession.State.READY
        session.decision_prompt_sent_at = now
        session.save(
            update_fields=[
                "candidate_deal_ids",
                "state",
                "decision_prompt_sent_at",
                "updated_at",
            ]
        )
        if candidates:
            self._set_search_mode(session, enabled=False)
            text = self._build_candidates_message(
                candidates,
                session,
                forward_match_count=len(forward_matches),
            )
            markup = self._build_candidates_keyboard(session, candidates)
            return text, markup
        text = (
            "Подходящих сделок не найдено.\n"
            "Нажмите «Поиск сделки», чтобы ввести текст запроса, или создайте новую сделку."
        )
        markup = self._build_create_only_keyboard(session)
        return text, markup

    def _is_search_mode(self, session) -> bool:
        extracted = dict(session.extracted_data or {})
        return bool(extracted.get("awaiting_search_query"))

    def _set_search_mode(self, session, *, enabled: bool) -> None:
        extracted = dict(session.extracted_data or {})
        extracted["awaiting_search_query"] = bool(enabled)
        session.extracted_data = extracted
        session.save(update_fields=["extracted_data", "updated_at"])

    def _get_collecting_session(self, user):
        return (
            TelegramDealRoutingSession.objects.filter(
                user=user,
                state__in=[
                    TelegramDealRoutingSession.State.COLLECTING,
                    TelegramDealRoutingSession.State.PENDING,
                ],
            )
            .order_by("-updated_at")
            .first()
        )

    def _get_ready_session(self, user):
        return (
            TelegramDealRoutingSession.objects.filter(
                user=user, state=TelegramDealRoutingSession.State.READY
            )
            .order_by("-updated_at")
            .first()
        )

    def _get_latest_non_final_session(self, user):
        return (
            TelegramDealRoutingSession.objects.filter(
                user=user,
                state__in=[
                    TelegramDealRoutingSession.State.COLLECTING,
                    TelegramDealRoutingSession.State.PENDING,
                    TelegramDealRoutingSession.State.READY,
                ],
            )
            .order_by("-updated_at")
            .first()
        )

    def _get_latest_expired_session(self, user):
        return (
            TelegramDealRoutingSession.objects.filter(
                user=user,
                state=TelegramDealRoutingSession.State.EXPIRED,
            )
            .order_by("-updated_at")
            .first()
        )

    def _find_or_create_client(self, *, user, extracted_data):
        emails = [str(email).lower() for email in (extracted_data.get("emails") or [])]
        phones = [str(phone) for phone in (extracted_data.get("phones") or [])]
        name = str(extracted_data.get("client_name") or "").strip()
        if emails:
            existing = (
                Client.objects.alive()
                .filter(email__isnull=False, email__iexact=emails[0])
                .order_by("-created_at")
                .first()
            )
            if existing:
                return existing
        if phones:
            normalized = _normalize_phone(phones[0])
            for client in Client.objects.alive().exclude(phone="").only("id", "phone"):
                cphone = _normalize_phone(client.phone)
                if cphone == normalized or (
                    len(normalized) >= 10 and cphone.endswith(normalized[-10:])
                ):
                    return client
        if name:
            existing = (
                Client.objects.alive()
                .filter(name__iexact=name)
                .order_by("-created_at")
                .first()
            )
            if existing:
                return existing
        return Client.objects.create(
            name=(name or "Клиент из Telegram")[:255],
            phone=(phones[0] if phones else "")[:20],
            email=(emails[0] if emails else None),
            created_by=user,
        )

    def _attach_batch_to_deal(self, *, user, session, deal, final_status):
        message_ids = list(session.batch_message_ids or [])
        first = (
            TelegramInboundMessage.objects.filter(routing_session=session)
            .order_by("created_at")
            .first()
        )
        chat_id = getattr(first, "chat_id", None)
        body = (
            str(session.aggregated_text or "").strip() or "(в пакете только вложения)"
        )
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
                file_data = self.client.get_file(file_id)
                file_path = str((file_data or {}).get("file_path") or "").strip()
                if not file_path:
                    raise ValueError("Telegram file_path is empty")
                content = self.client.download_file(file_path)
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
                drive_uploaded, failure_code = self._upload_attachment_to_drive(
                    user=user,
                    deal=deal,
                    file_name=file_name,
                    mime_type=mime_type,
                    content=content,
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
        return saved, failed, self._build_drive_failure_hint(failure_codes)

    def _build_drive_failure_hint(self, failure_codes: set[str]) -> str:
        if not failure_codes:
            return ""
        if "config" in failure_codes:
            return "внутренняя интеграция Google Drive не настроена"
        if "folder" in failure_codes:
            return "Google Drive недоступен или нет доступа к папке сделки"
        if "upload" in failure_codes:
            return "файл не удалось загрузить в Google Drive"
        return "Google Drive недоступен или не принял файл"

    def _upload_attachment_to_drive(
        self,
        *,
        user,
        deal: Deal,
        file_name: str,
        mime_type: str,
        content: bytes,
    ) -> tuple[bool, str | None]:
        api_mode_result = self._upload_attachment_via_backend_api(
            user=user,
            deal=deal,
            file_name=file_name,
            mime_type=mime_type,
            content=content,
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

    def _upload_attachment_via_backend_api(
        self,
        *,
        user,
        deal: Deal,
        file_name: str,
        mime_type: str,
        content: bytes,
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
