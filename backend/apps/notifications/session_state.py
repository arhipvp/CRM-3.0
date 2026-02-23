from __future__ import annotations

from django.utils import timezone

from .models import TelegramDealRoutingSession, TelegramInboundMessage


def get_collecting_session(user):
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


def get_ready_session(user):
    return (
        TelegramDealRoutingSession.objects.filter(
            user=user, state=TelegramDealRoutingSession.State.READY
        )
        .order_by("-updated_at")
        .first()
    )


def get_latest_non_final_session(user):
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


def get_latest_expired_session(user):
    return (
        TelegramDealRoutingSession.objects.filter(
            user=user,
            state=TelegramDealRoutingSession.State.EXPIRED,
        )
        .order_by("-updated_at")
        .first()
    )


def expire_session(session: TelegramDealRoutingSession) -> None:
    session.state = TelegramDealRoutingSession.State.EXPIRED
    session.save(update_fields=["state", "updated_at"])
    TelegramInboundMessage.objects.filter(
        routing_session=session,
        processed_at__isnull=True,
    ).update(
        status=TelegramInboundMessage.Status.EXPIRED,
        processed_at=timezone.now(),
    )


def is_search_mode(session) -> bool:
    extracted = dict(session.extracted_data or {})
    return bool(extracted.get("awaiting_search_query"))


def set_search_mode(session, *, enabled: bool) -> None:
    extracted = dict(session.extracted_data or {})
    extracted["awaiting_search_query"] = bool(enabled)
    session.extracted_data = extracted
    session.save(update_fields=["extracted_data", "updated_at"])


def send_or_update_session_message(
    *,
    client,
    chat_id: int,
    session,
    text: str,
    reply_markup: dict | None = None,
) -> None:
    status_message_id = session.status_message_id
    if status_message_id:
        edited = client.edit_message_text(
            chat_id=chat_id,
            message_id=int(status_message_id),
            text=text,
            reply_markup=reply_markup,
        )
        if edited:
            return
    sent_message_id = client.send_message(
        chat_id,
        text,
        reply_markup=reply_markup,
    )
    if sent_message_id:
        session.status_message_id = int(sent_message_id)
        session.save(update_fields=["status_message_id", "updated_at"])
