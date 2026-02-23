import logging
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import timedelta

from apps.common.drive import ensure_deal_folder, upload_file_to_drive
from apps.deals.models import Deal
from django.conf import settings
from django.utils import timezone

from .finalization import (
    attach_batch_to_deal,
    build_drive_failure_hint,
    find_or_create_client,
    upload_attachment_to_drive,
    upload_attachment_via_backend_api,
)
from .message_collector import (
    BATCH_TIMEOUT_SECONDS,
    SESSION_TTL_MINUTES,
    append_to_batch,
    collect_attachments,
    extract_forward_sender_name,
    extract_source_text,
    merge_extracted_data,
)
from .models import TelegramDealRoutingSession, TelegramInboundMessage
from .routing import (
    build_candidates_keyboard,
    build_candidates_message,
    build_collecting_keyboard,
    build_create_only_keyboard,
    build_search_empty_keyboard,
    build_search_keyboard,
    deal_queryset_for_user,
    find_candidate_deals,
    find_forward_name_deals,
    parse_callback,
    search_deals_by_query,
    sort_deals_by_next_contact,
)
from .session_state import (
    expire_session,
    get_collecting_session,
    get_latest_expired_session,
    get_latest_non_final_session,
    get_ready_session,
    is_search_mode,
    send_or_update_session_message,
    set_search_mode,
)

logger = logging.getLogger(__name__)


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
            self._expire_session(session)
        return len(ids)

    def finalize_ready_batches(self) -> int:
        self.expire_stale_sessions()
        now = timezone.now()
        count = 0
        seen_user_ids: set[int] = set()
        qs = (
            TelegramDealRoutingSession.objects.filter(
                state__in=[
                    TelegramDealRoutingSession.State.COLLECTING,
                    TelegramDealRoutingSession.State.PENDING,
                ],
                decision_prompt_sent_at__isnull=True,
            )
            .select_related("user")
            .order_by("user_id", "-updated_at")
        )
        for session in qs:
            if session.user_id in seen_user_ids:
                self._expire_session(session)
                continue
            seen_user_ids.add(session.user_id)
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
        source_text = extract_source_text(message)
        forward_sender_name = extract_forward_sender_name(message)
        attachments = collect_attachments(message)

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
            self._expire_session(session)
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
            "Результаты поиска:",
            "Выберите сделку кнопкой ниже.",
        ]
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
        return parse_callback(data)

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
        append_to_batch(
            session=session,
            inbound=inbound,
            source_text=source_text,
            attachments=attachments,
            message=message,
            update_id=update_id,
            forward_sender_name=forward_sender_name,
        )

    def _send_or_update_session_message(
        self,
        *,
        chat_id: int,
        session,
        text: str,
        reply_markup: dict | None = None,
    ) -> None:
        send_or_update_session_message(
            client=self.client,
            chat_id=chat_id,
            session=session,
            text=text,
            reply_markup=reply_markup,
        )

    def _merge_extracted_data(self, current: dict, incoming: dict) -> dict:
        return merge_extracted_data(current, incoming)

    def _deal_queryset_for_user(self, user):
        return deal_queryset_for_user(user)

    def _expire_session(self, session: TelegramDealRoutingSession) -> None:
        expire_session(session)

    def _sort_deals_by_next_contact(self, deals: list[Deal]) -> list[Deal]:
        return sort_deals_by_next_contact(deals)

    def _find_candidate_deals(self, *, user, extracted_data: dict) -> list[Deal]:
        return find_candidate_deals(user=user, extracted_data=extracted_data)

    def _search_deals_by_query(self, *, user, query: str) -> list[Deal]:
        return search_deals_by_query(user=user, query=query)

    def _find_forward_name_deals(self, *, user, forward_sender_name: str) -> list[Deal]:
        return find_forward_name_deals(
            user=user, forward_sender_name=forward_sender_name
        )

    def _build_candidates_message(
        self, candidates, session, *, forward_match_count: int = 0
    ):
        return build_candidates_message(
            candidates, session, forward_match_count=forward_match_count
        )

    def _build_candidates_keyboard(self, session, candidates):
        return build_candidates_keyboard(session, candidates)

    def _build_collecting_keyboard(self, session):
        return build_collecting_keyboard(session)

    def _build_create_only_keyboard(self, session):
        return build_create_only_keyboard(session)

    def _build_search_keyboard(self, session):
        return build_search_keyboard(session)

    def _build_search_empty_keyboard(self, session):
        return build_search_empty_keyboard(session)

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
        candidates = self._sort_deals_by_next_contact(candidates)[:5]
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
        return is_search_mode(session)

    def _set_search_mode(self, session, *, enabled: bool) -> None:
        set_search_mode(session, enabled=enabled)

    def _get_collecting_session(self, user):
        return get_collecting_session(user)

    def _get_ready_session(self, user):
        return get_ready_session(user)

    def _get_latest_non_final_session(self, user):
        return get_latest_non_final_session(user)

    def _get_latest_expired_session(self, user):
        return get_latest_expired_session(user)

    def _find_or_create_client(self, *, user, extracted_data):
        return find_or_create_client(user=user, extracted_data=extracted_data)

    def _attach_batch_to_deal(self, *, user, session, deal, final_status):
        return attach_batch_to_deal(
            tg_client=self.client,
            user=user,
            session=session,
            deal=deal,
            final_status=final_status,
            logger=logger,
            drive_uploader=self._upload_attachment_to_drive,
        )

    def _build_drive_failure_hint(self, failure_codes: set[str]) -> str:
        return build_drive_failure_hint(failure_codes)

    def _upload_attachment_to_drive(
        self,
        *,
        user,
        deal: Deal,
        file_name: str,
        mime_type: str,
        content: bytes,
        logger: logging.Logger | None = None,
    ) -> tuple[bool, str | None]:
        active_logger = logger or logging.getLogger(__name__)
        return upload_attachment_to_drive(
            user=user,
            deal=deal,
            file_name=file_name,
            mime_type=mime_type,
            content=content,
            logger=active_logger,
            api_uploader=self._upload_attachment_via_backend_api,
            ensure_deal_folder_fn=ensure_deal_folder,
            upload_file_to_drive_fn=upload_file_to_drive,
        )

    def _upload_attachment_via_backend_api(
        self,
        *,
        user,
        deal: Deal,
        file_name: str,
        mime_type: str,
        content: bytes,
        logger: logging.Logger | None = None,
    ) -> tuple[bool, str | None] | None:
        active_logger = logger or logging.getLogger(__name__)
        return upload_attachment_via_backend_api(
            user=user,
            deal=deal,
            file_name=file_name,
            mime_type=mime_type,
            content=content,
            logger=active_logger,
            urlopen=urllib.request.urlopen,
            request_factory=urllib.request.Request,
        )
