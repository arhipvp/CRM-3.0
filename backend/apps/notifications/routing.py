from __future__ import annotations

import re

from apps.deals.models import Deal
from apps.deals.permissions import is_admin_user
from django.db.models import F, Q
from django.utils import timezone

from .message_collector import NAME_TOKEN_RE, normalize_phone

CALLBACK_PREFIX = "tgintake"


def parse_callback(data: str) -> dict | None:
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


def deal_queryset_for_user(user):
    qs = Deal.objects.alive().select_related("client")
    if is_admin_user(user):
        return qs
    return qs.filter(
        Q(seller=user) | Q(executor=user) | Q(visible_users=user)
    ).distinct()


def sort_deals_by_next_contact(deals: list[Deal]) -> list[Deal]:
    return sorted(
        deals,
        key=lambda item: (
            getattr(item, "next_contact_date", None) is None,
            getattr(item, "next_contact_date", None) or timezone.localdate(),
            -int(item.created_at.timestamp()),
        ),
    )


def format_candidate_button_text(deal: Deal) -> str:
    client_name = str(getattr(getattr(deal, "client", None), "name", "")).strip()
    deal_title = str(deal.title or "").strip()
    next_contact = getattr(deal, "next_contact_date", None)
    next_contact_text = (
        next_contact.strftime("%d.%m.%Y") if next_contact else "без даты"
    )
    button_text = deal_title[:36] if deal_title else "Сделка"
    if client_name:
        button_text = f"{button_text} ({client_name[:18]})"
    return f"{button_text} · {next_contact_text}"[:64]


def find_candidate_deals(*, user, extracted_data: dict) -> list[Deal]:
    phones = extracted_data.get("phones") or []
    emails = extracted_data.get("emails") or []
    name = str(extracted_data.get("client_name") or "").strip().lower()
    if not phones and not emails and not name:
        return []
    scored: list[tuple[int, Deal]] = []
    for deal in deal_queryset_for_user(user):
        client = getattr(deal, "client", None)
        if not client:
            continue
        score = 0
        cphone = normalize_phone(getattr(client, "phone", ""))
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
    top_scored = [deal for _, deal in scored[:25]]
    return sort_deals_by_next_contact(top_scored)[:5]


def search_deals_by_query(*, user, query: str) -> list[Deal]:
    normalized_query = str(query or "").strip()
    if not normalized_query:
        return []
    return list(
        deal_queryset_for_user(user)
        .filter(
            Q(title__icontains=normalized_query)
            | Q(client__name__icontains=normalized_query)
        )
        .order_by(
            F("next_contact_date").asc(nulls_last=True),
            "-created_at",
        )[:5]
    )


def find_forward_name_deals(*, user, forward_sender_name: str) -> list[Deal]:
    raw_name = str(forward_sender_name or "").strip().lower()
    tokens = [token for token in NAME_TOKEN_RE.findall(raw_name) if len(token) >= 2]
    unique_tokens: list[str] = []
    for token in tokens:
        if token not in unique_tokens:
            unique_tokens.append(token)
    if len(unique_tokens) < 2:
        return []
    matches: list[Deal] = []
    for deal in deal_queryset_for_user(user):
        client_name = str(getattr(getattr(deal, "client", None), "name", "")).lower()
        if client_name and all(token in client_name for token in unique_tokens):
            matches.append(deal)
    matches.sort(
        key=lambda item: (
            item.status != Deal.DealStatus.OPEN,
            -int(item.created_at.timestamp()),
        )
    )
    return sort_deals_by_next_contact(matches)[:5]


def build_candidates_message(candidates, session, *, forward_match_count: int = 0):
    lines = [
        f"Пакет готов: сообщений {len(session.batch_message_ids or [])}, файлов {len(session.aggregated_attachments or [])}.",
    ]
    if forward_match_count > 0:
        lines.append("Найдено по ФИО из переслано от… Выберите номер сделки:")
    else:
        lines.append("Найдены подходящие сделки. Выберите номер:")
    for idx, deal in enumerate(candidates, start=1):
        cname = getattr(getattr(deal, "client", None), "name", "")
        lines.append(f"{idx}. {deal.title} (клиент: {cname}, статус: {deal.status})")
    lines.append("")
    lines.append(
        "Выберите нужную сделку кнопкой ниже. Для другого запроса нажмите «Поиск сделки»."
    )
    return "\n".join(lines)


def build_candidates_keyboard(session, candidates):
    rows = []
    for deal in candidates:
        button_text = format_candidate_button_text(deal)
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


def build_collecting_keyboard(session):
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


def build_create_only_keyboard(session):
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


def build_search_keyboard(session):
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


def build_search_empty_keyboard(session):
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
