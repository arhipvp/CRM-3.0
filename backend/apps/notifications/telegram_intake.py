import logging
import mimetypes
import re
from dataclasses import dataclass
from datetime import timedelta

from apps.clients.models import Client
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
CALLBACK_PREFIX = "tgintake"
SESSION_TTL_MINUTES = 30


@dataclass
class IntakeResult:
    text: str
    reply_markup: dict | None = None


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
    if message.get("forward_sender_name"):
        forward_parts.append(str(message["forward_sender_name"]).strip())
    forward_from = message.get("forward_from") or {}
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
        username = str(forward_from.get("username") or "").strip()
        if username:
            forward_parts.append(f"@{username}")
    forward_chat = message.get("forward_from_chat") or {}
    if forward_chat:
        title = str(forward_chat.get("title") or "").strip()
        if title:
            forward_parts.append(title)
        username = str(forward_chat.get("username") or "").strip()
        if username:
            forward_parts.append(f"@{username}")
    if forward_parts:
        prefix = f"Переслано из: {', '.join(dict.fromkeys(forward_parts))}"
        return f"{prefix}\n{text}".strip()
    return text


def _extract_data(source_text: str) -> dict:
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

    title = ""
    for line in lines:
        if line and not line.lower().startswith("переслано из:"):
            title = line[:120]
            break
    if not title:
        title = "Сделка из Telegram"

    return {
        "phones": phones,
        "emails": emails,
        "client_name": client_name[:255],
        "title": title,
    }


def _collect_attachments(message: dict) -> list[dict]:
    attachments: list[dict] = []
    document = message.get("document") or {}
    if document and document.get("file_id"):
        attachments.append(
            {
                "kind": "document",
                "file_id": str(document.get("file_id")),
                "file_name": str(document.get("file_name") or "").strip() or "",
                "mime_type": str(document.get("mime_type") or "").strip() or "",
            }
        )

    photos = message.get("photo") or []
    if isinstance(photos, list) and photos:
        largest = photos[-1]
        file_id = str(largest.get("file_id") or "").strip()
        if file_id:
            attachments.append(
                {
                    "kind": "photo",
                    "file_id": file_id,
                    "file_name": "",
                    "mime_type": "image/jpeg",
                }
            )
    return attachments


class TelegramIntakeService:
    def __init__(self, client) -> None:
        self.client = client

    def build_help_message(self) -> str:
        return (
            "Команды Telegram intake:\n"
            "/help - показать помощь\n"
            "/pick <номер> - выбрать сделку из предложенных\n"
            "/create - создать новую сделку по последнему сообщению\n"
            "/cancel - отменить текущий выбор\n\n"
            "Перешлите сообщение (или отправьте текст/файл) в личный чат с ботом."
        )

    def expire_stale_sessions(self, user=None) -> int:
        queryset = TelegramDealRoutingSession.objects.filter(
            state=TelegramDealRoutingSession.State.PENDING,
            expires_at__lte=timezone.now(),
        )
        if user is not None:
            queryset = queryset.filter(user=user)
        ids = list(queryset.values_list("id", flat=True))
        if not ids:
            return 0
        sessions = TelegramDealRoutingSession.objects.filter(id__in=ids).select_related(
            "inbound_message"
        )
        for session in sessions:
            session.state = TelegramDealRoutingSession.State.EXPIRED
            session.save(update_fields=["state", "updated_at"])
            inbound = session.inbound_message
            inbound.status = TelegramInboundMessage.Status.EXPIRED
            inbound.processed_at = timezone.now()
            inbound.save(update_fields=["status", "processed_at", "updated_at"])
        return len(ids)

    def process_message(
        self,
        *,
        user,
        update_id: int,
        chat_id: int,
        message: dict,
    ) -> IntakeResult:
        self.expire_stale_sessions(user=user)
        message_id = int(message.get("message_id") or 0)
        source_text = _extract_source_text(message)
        attachments = _collect_attachments(message)

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

        if not created and inbound.processed_at:
            link = _build_deal_link(getattr(inbound.linked_deal, "id", None))
            suffix = f"\nСделка: {link}" if link else ""
            return IntakeResult(
                f"Это сообщение уже обработано (статус: {inbound.status}).{suffix}"
            )

        self._cancel_user_pending_sessions(user=user, exclude_inbound_id=inbound.id)
        inbound.user = user
        inbound.update_id = int(update_id or 0)
        inbound.text = source_text
        inbound.payload = message
        inbound.status = TelegramInboundMessage.Status.WAITING_DECISION
        inbound.save(
            update_fields=[
                "user",
                "update_id",
                "text",
                "payload",
                "status",
                "updated_at",
            ]
        )

        extracted = _extract_data(source_text)
        extracted["attachments"] = attachments
        candidates = self._find_candidate_deals(user=user, extracted_data=extracted)
        candidate_ids = [str(item.id) for item in candidates]

        session, _ = TelegramDealRoutingSession.objects.update_or_create(
            inbound_message=inbound,
            defaults={
                "user": user,
                "state": TelegramDealRoutingSession.State.PENDING,
                "expires_at": timezone.now() + timedelta(minutes=SESSION_TTL_MINUTES),
                "extracted_data": extracted,
                "candidate_deal_ids": candidate_ids,
                "selected_deal": None,
                "created_client": None,
                "created_deal": None,
            },
        )

        if candidates:
            return IntakeResult(
                text=self._build_candidates_message(candidates),
                reply_markup=self._build_candidates_keyboard(session, candidates),
            )
        return IntakeResult(
            text=(
                "Подходящих сделок не найдено.\n"
                "Можно создать новую сделку из этого сообщения.\n"
                "Команды: /create или /cancel"
            ),
            reply_markup=self._build_create_only_keyboard(session),
        )

    def process_pick(
        self,
        *,
        user,
        pick_index: int,
        session: TelegramDealRoutingSession | None = None,
    ) -> IntakeResult:
        self.expire_stale_sessions(user=user)
        session = session or self._get_active_session(user)
        if not session:
            return IntakeResult("Нет активного выбора. Перешлите сообщение заново.")
        if session.is_expired:
            self._expire_session(session)
            return IntakeResult("Сессия выбора истекла. Перешлите сообщение заново.")
        if pick_index < 1:
            return IntakeResult("Номер сделки должен быть больше 0.")

        candidate_ids = [str(item) for item in (session.candidate_deal_ids or [])]
        if pick_index > len(candidate_ids):
            return IntakeResult("Некорректный номер сделки. Используйте /pick <номер>.")

        deal_id = candidate_ids[pick_index - 1]
        deal = (
            self._deal_queryset_for_user(user)
            .filter(id=deal_id)
            .select_related("client")
            .first()
        )
        if not deal:
            return IntakeResult("Сделка недоступна или не найдена.")

        saved_files, failed_files = self._attach_inbound_to_deal(
            user=user,
            inbound=session.inbound_message,
            deal=deal,
            extracted_data=session.extracted_data or {},
            final_status=TelegramInboundMessage.Status.LINKED_EXISTING,
        )
        session.state = TelegramDealRoutingSession.State.LINKED_EXISTING
        session.selected_deal = deal
        session.save(update_fields=["state", "selected_deal", "updated_at"])

        link = _build_deal_link(deal.id)
        link_line = f"\nСделка: {link}" if link else ""
        fail_line = f"\nОшибки файлов: {failed_files}" if failed_files else ""
        return IntakeResult(
            (
                f"Сообщение привязано к сделке '{deal.title}'.\n"
                f"Сохранено файлов: {saved_files}.{fail_line}{link_line}"
            )
        )

    def process_create(
        self, *, user, session: TelegramDealRoutingSession | None = None
    ) -> IntakeResult:
        self.expire_stale_sessions(user=user)
        session = session or self._get_active_session(user)
        if not session:
            return IntakeResult("Нет активного выбора. Перешлите сообщение заново.")
        if session.is_expired:
            self._expire_session(session)
            return IntakeResult("Сессия выбора истекла. Перешлите сообщение заново.")

        extracted = session.extracted_data or {}
        client = self._find_or_create_client(user=user, extracted_data=extracted)
        deal_title = (
            str(extracted.get("title") or "Сделка из Telegram").strip()[:255]
            or "Сделка из Telegram"
        )
        deal = Deal.objects.create(
            title=deal_title,
            client=client,
            seller=user,
            status=Deal.DealStatus.OPEN,
            source="telegram",
        )
        saved_files, failed_files = self._attach_inbound_to_deal(
            user=user,
            inbound=session.inbound_message,
            deal=deal,
            extracted_data=extracted,
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
        link_line = f"\nСделка: {link}" if link else ""
        fail_line = f"\nОшибки файлов: {failed_files}" if failed_files else ""
        return IntakeResult(
            (
                f"Создана новая сделка '{deal.title}' для клиента '{client.name}'.\n"
                f"Сохранено файлов: {saved_files}.{fail_line}{link_line}"
            )
        )

    def process_cancel(
        self, *, user, session: TelegramDealRoutingSession | None = None
    ) -> IntakeResult:
        self.expire_stale_sessions(user=user)
        session = session or self._get_active_session(user)
        if not session:
            return IntakeResult("Нет активной сессии.")
        session.state = TelegramDealRoutingSession.State.CANCELED
        session.save(update_fields=["state", "updated_at"])
        inbound = session.inbound_message
        inbound.status = TelegramInboundMessage.Status.CANCELED
        inbound.processed_at = timezone.now()
        inbound.save(update_fields=["status", "processed_at", "updated_at"])
        return IntakeResult("Выбор отменён. Можете переслать новое сообщение.")

    def parse_callback(self, data: str) -> tuple[str, int | None, int | None] | None:
        if not data or not data.startswith(f"{CALLBACK_PREFIX}:"):
            return None
        parts = data.split(":")
        if len(parts) < 3:
            return None
        action = parts[1]
        try:
            session_id = int(parts[2])
        except (TypeError, ValueError):
            return None
        pick_index = None
        if action == "pick":
            if len(parts) < 4:
                return None
            try:
                pick_index = int(parts[3])
            except (TypeError, ValueError):
                return None
        return action, session_id, pick_index

    def process_callback(
        self,
        *,
        user,
        callback_data: str,
    ) -> IntakeResult:
        parsed = self.parse_callback(callback_data)
        if not parsed:
            return IntakeResult("Неизвестная команда кнопки.")
        action, session_id, pick_index = parsed
        session = (
            TelegramDealRoutingSession.objects.filter(
                id=session_id,
                user=user,
            )
            .select_related("inbound_message")
            .first()
        )
        if not session:
            return IntakeResult("Сессия не найдена.")
        if session.state != TelegramDealRoutingSession.State.PENDING:
            return IntakeResult("Эта сессия уже завершена.")
        if session.is_expired:
            self._expire_session(session)
            return IntakeResult("Сессия выбора истекла. Перешлите сообщение заново.")

        if action == "pick" and pick_index is not None:
            return self.process_pick(user=user, pick_index=pick_index, session=session)
        if action == "create":
            return self.process_create(user=user, session=session)
        if action == "cancel":
            return self.process_cancel(user=user, session=session)
        return IntakeResult("Неизвестное действие.")

    def _cancel_user_pending_sessions(self, *, user, exclude_inbound_id=None) -> None:
        sessions = TelegramDealRoutingSession.objects.filter(
            user=user,
            state=TelegramDealRoutingSession.State.PENDING,
        ).select_related("inbound_message")
        if exclude_inbound_id is not None:
            sessions = sessions.exclude(inbound_message_id=exclude_inbound_id)
        now = timezone.now()
        for session in sessions:
            session.state = TelegramDealRoutingSession.State.CANCELED
            session.save(update_fields=["state", "updated_at"])
            inbound = session.inbound_message
            inbound.status = TelegramInboundMessage.Status.CANCELED
            inbound.processed_at = now
            inbound.save(update_fields=["status", "processed_at", "updated_at"])

    def _deal_queryset_for_user(self, user):
        queryset = Deal.objects.alive().select_related("client")
        if is_admin_user(user):
            return queryset
        return queryset.filter(
            Q(seller=user) | Q(executor=user) | Q(visible_users=user)
        ).distinct()

    def _find_candidate_deals(self, *, user, extracted_data: dict) -> list[Deal]:
        phones = extracted_data.get("phones") or []
        emails = extracted_data.get("emails") or []
        client_name = str(extracted_data.get("client_name") or "").strip()
        if not phones and not emails and not client_name:
            return []

        deals = list(self._deal_queryset_for_user(user))
        scored: list[tuple[int, Deal]] = []
        for deal in deals:
            score = self._score_deal(
                deal=deal, phones=phones, emails=emails, client_name=client_name
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

    def _score_deal(
        self,
        *,
        deal: Deal,
        phones: list[str],
        emails: list[str],
        client_name: str,
    ) -> int:
        score = 0
        client = getattr(deal, "client", None)
        if not client:
            return score

        client_phone = _normalize_phone(getattr(client, "phone", ""))
        client_email = str(getattr(client, "email", "") or "").strip().lower()
        name = str(getattr(client, "name", "") or "").strip().lower()

        for phone in phones:
            if client_phone and phone == client_phone:
                score += 8
            elif (
                client_phone and len(phone) >= 10 and phone[-10:] == client_phone[-10:]
            ):
                score += 6

        for email in emails:
            if client_email and email == client_email:
                score += 8

        if client_name and name:
            tokens = [token for token in re.split(r"\s+", client_name.lower()) if token]
            if tokens:
                overlap = sum(1 for token in tokens if token in name)
                score += overlap * 2
        return score

    def _build_candidates_message(self, candidates: list[Deal]) -> str:
        lines = [
            "Найдены подходящие сделки. Выберите номер:",
        ]
        for idx, deal in enumerate(candidates, start=1):
            client_name = getattr(getattr(deal, "client", None), "name", "")
            lines.append(
                f"{idx}. {deal.title} (клиент: {client_name}, статус: {deal.status})"
            )
        lines.append("")
        lines.append("Команды: /pick <номер>, /create, /cancel")
        return "\n".join(lines)

    def _build_candidates_keyboard(
        self, session: TelegramDealRoutingSession, candidates: list[Deal]
    ) -> dict:
        keyboard_rows: list[list[dict]] = []
        for idx, _deal in enumerate(candidates, start=1):
            keyboard_rows.append(
                [
                    {
                        "text": f"Выбрать #{idx}",
                        "callback_data": f"{CALLBACK_PREFIX}:pick:{session.id}:{idx}",
                    }
                ]
            )
        keyboard_rows.append(
            [
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
        return {"inline_keyboard": keyboard_rows}

    def _build_create_only_keyboard(self, session: TelegramDealRoutingSession) -> dict:
        return {
            "inline_keyboard": [
                [
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

    def _get_active_session(self, user) -> TelegramDealRoutingSession | None:
        return (
            TelegramDealRoutingSession.objects.filter(
                user=user,
                state=TelegramDealRoutingSession.State.PENDING,
            )
            .select_related("inbound_message")
            .order_by("-created_at")
            .first()
        )

    def _expire_session(self, session: TelegramDealRoutingSession) -> None:
        if session.state != TelegramDealRoutingSession.State.PENDING:
            return
        session.state = TelegramDealRoutingSession.State.EXPIRED
        session.save(update_fields=["state", "updated_at"])
        inbound = session.inbound_message
        inbound.status = TelegramInboundMessage.Status.EXPIRED
        inbound.processed_at = timezone.now()
        inbound.save(update_fields=["status", "processed_at", "updated_at"])

    def _find_or_create_client(self, *, user, extracted_data: dict) -> Client:
        emails = [str(email).lower() for email in (extracted_data.get("emails") or [])]
        phones = [str(phone) for phone in (extracted_data.get("phones") or [])]
        client_name = str(extracted_data.get("client_name") or "").strip()

        if emails:
            existing = (
                Client.objects.alive()
                .filter(email__isnull=False)
                .filter(email__iexact=emails[0])
                .order_by("-created_at")
                .first()
            )
            if existing:
                return existing

        if phones:
            existing = self._find_client_by_phone(phones[0])
            if existing:
                return existing

        if client_name:
            existing = (
                Client.objects.alive()
                .filter(name__iexact=client_name)
                .order_by("-created_at")
                .first()
            )
            if existing:
                return existing

        name = client_name or "Клиент из Telegram"
        email = emails[0] if emails else None
        phone = phones[0] if phones else ""
        return Client.objects.create(
            name=name[:255],
            phone=phone[:20],
            email=email,
            created_by=user,
        )

    def _find_client_by_phone(self, phone: str) -> Client | None:
        normalized = _normalize_phone(phone)
        if not normalized:
            return None
        for client in Client.objects.alive().exclude(phone="").only("id", "phone"):
            if _normalize_phone(client.phone) == normalized:
                return client
            if len(normalized) >= 10 and _normalize_phone(client.phone).endswith(
                normalized[-10:]
            ):
                return client
        return None

    def _attach_inbound_to_deal(
        self,
        *,
        user,
        inbound: TelegramInboundMessage,
        deal: Deal,
        extracted_data: dict,
        final_status: str,
    ) -> tuple[int, int]:
        source_text = str(inbound.text or "").strip()
        note_text = (
            f"Источник: Telegram\n"
            f"Chat ID: {inbound.chat_id}\n"
            f"Message ID: {inbound.message_id}\n\n"
            f"{source_text or '(без текста)'}"
        )
        Note.objects.create(
            deal=deal,
            body=note_text,
            author=user,
            author_name="Telegram bot",
        )

        saved_files = 0
        failed_files = 0
        attachments = extracted_data.get("attachments") or []
        for idx, item in enumerate(attachments, start=1):
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
                    if item.get("kind") == "photo":
                        file_name = f"telegram_{inbound.message_id}_{idx}.jpg"
                    else:
                        file_name = f"telegram_{inbound.message_id}_{idx}.bin"
                mime_type = str(item.get("mime_type") or "").strip()
                if not mime_type:
                    mime_type = mimetypes.guess_type(file_name)[0] or ""

                document = Document(
                    deal=deal,
                    owner=user,
                    title=file_name[:255],
                    mime_type=mime_type,
                )
                document.file.save(file_name, ContentFile(content), save=False)
                document.save()
                saved_files += 1
            except Exception as exc:  # noqa: BLE001
                failed_files += 1
                logger.warning(
                    "Telegram attachment save failed for chat_id=%s message_id=%s: %s",
                    inbound.chat_id,
                    inbound.message_id,
                    exc,
                )

        inbound.linked_deal = deal
        inbound.processed_at = timezone.now()
        inbound.status = final_status
        inbound.save(
            update_fields=["linked_deal", "processed_at", "status", "updated_at"]
        )
        return saved_files, failed_files
