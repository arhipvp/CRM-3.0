import logging
import secrets
from datetime import timedelta

from django.conf import settings
from django.utils import timezone

from .models import (
    NotificationDelivery,
    NotificationSettings,
    TelegramProfile,
    _default_remind_days,
)
from .telegram_client import TelegramClient

logger = logging.getLogger(__name__)

_client: TelegramClient | None = None


def get_telegram_client() -> TelegramClient | None:
    global _client
    token = getattr(settings, "TELEGRAM_BOT_TOKEN", "")
    if not token:
        logger.warning("TELEGRAM_BOT_TOKEN is empty")
        return None
    if _client is None:
        timeout = getattr(settings, "TELEGRAM_POLL_TIMEOUT", 30)
        _client = TelegramClient(token=token, timeout=timeout)
    return _client


def get_or_create_settings(user) -> NotificationSettings:
    settings_obj, _ = NotificationSettings.objects.get_or_create(user=user)
    return settings_obj


def get_or_create_profile(user) -> TelegramProfile:
    profile, _ = TelegramProfile.objects.get_or_create(user=user)
    return profile


def generate_link_code(user) -> TelegramProfile:
    profile = get_or_create_profile(user)
    profile.link_code = secrets.token_urlsafe(16)
    ttl_minutes = getattr(settings, "TELEGRAM_LINK_CODE_TTL_MINUTES", 10)
    profile.link_code_expires_at = timezone.now() + timedelta(minutes=ttl_minutes)
    profile.save(update_fields=["link_code", "link_code_expires_at"])
    return profile


def _build_deal_link(deal_id: str | int | None) -> str:
    if not deal_id:
        return ""
    base_url = getattr(settings, "CRM_PUBLIC_URL", "").strip().rstrip("/")
    if not base_url:
        return ""
    return f"{base_url}/deals?dealId={deal_id}"


def _append_link(text: str, deal_id: str | int | None) -> str:
    link = _build_deal_link(deal_id)
    if not link:
        return text
    return f"{text}\n{link}"


def _format_date(value) -> str:
    if not value:
        return ""
    return value.strftime("%d.%m.%Y")


def _format_deal_title(deal) -> str:
    if not deal:
        return ""
    title = getattr(deal, "title", "")
    client = getattr(deal, "client", None)
    client_name = getattr(client, "name", "")
    if client_name:
        return f"{title} (клиент: {client_name})"
    return title


def send_notification(
    *,
    user,
    text: str,
    event_type: str,
    object_type: str = "",
    object_id: str | None = None,
    trigger_date=None,
    setting_attr: str | None = None,
) -> bool:
    if user is None:
        return False

    settings_obj = get_or_create_settings(user)
    if not settings_obj.telegram_enabled:
        return False
    if setting_attr and not getattr(settings_obj, setting_attr, False):
        return False

    profile = getattr(user, "telegram_profile", None)
    if not profile or not profile.chat_id:
        return False

    if trigger_date is None:
        trigger_date = timezone.localdate()

    object_id_value = str(object_id) if object_id else ""

    if NotificationDelivery.objects.filter(
        user=user,
        event_type=event_type,
        object_type=object_type,
        object_id=object_id_value,
        trigger_date=trigger_date,
    ).exists():
        return False

    client = get_telegram_client()
    if client is None:
        return False

    if not client.send_message(profile.chat_id, text):
        return False

    NotificationDelivery.objects.create(
        user=user,
        event_type=event_type,
        object_type=object_type,
        object_id=object_id_value,
        trigger_date=trigger_date,
        metadata={"text": text},
    )
    return True


def notify_task_created(task) -> None:
    assignee = getattr(task, "assignee", None)
    if not assignee:
        return
    deal = getattr(task, "deal", None)
    deal_title = _format_deal_title(deal)
    deal_part = f" (сделка: {deal_title})" if deal_title else ""
    text = _append_link(
        f"Новая задача: {task.title}{deal_part}", getattr(deal, "id", None)
    )
    send_notification(
        user=assignee,
        text=text,
        event_type="task_created",
        object_type="task",
        object_id=task.id,
        trigger_date=timezone.localdate(task.created_at),
        setting_attr="notify_tasks",
    )


def notify_deal_event(deal, message: str) -> None:
    message_with_link = _append_link(message, getattr(deal, "id", None))
    for user in _get_deal_recipients(deal):
        send_notification(
            user=user,
            text=message_with_link,
            event_type="deal_event",
            object_type="deal",
            object_id=deal.id,
            trigger_date=timezone.localdate(),
            setting_attr="notify_deal_events",
        )


def send_expected_close_reminders() -> None:
    from apps.deals.models import Deal

    today = timezone.localdate()
    closed_statuses = {Deal.DealStatus.WON, Deal.DealStatus.LOST}
    deals = Deal.objects.filter(expected_close__isnull=False).exclude(
        status__in=closed_statuses
    )

    for deal in deals:
        delta_days = (deal.expected_close - today).days
        if delta_days < 0 or delta_days > 5:
            continue
        for user in _get_deal_recipients(deal):
            formatted_date = _format_date(deal.expected_close)
            deal_title = _format_deal_title(deal)
            deal_part = f", сделка {deal_title}" if deal_title else ""
            attention_prefix = "Внимание!"
            if delta_days < 3:
                attention_prefix = f"❗ {attention_prefix}"
            text = _append_link(
                (
                    f"{attention_prefix} Застраховать до {formatted_date}, "
                    f"осталось {delta_days} дн.{deal_part}"
                ),
                deal.id,
            )
            send_notification(
                user=user,
                text=text,
                event_type="deal_expected_close_reminder",
                object_type="deal",
                object_id=deal.id,
                trigger_date=today,
                setting_attr="notify_deal_expected_close",
            )


def send_payment_due_reminders() -> None:
    from apps.deals.models import Deal
    from apps.finances.models import Payment

    today = timezone.localdate()
    closed_statuses = {Deal.DealStatus.WON, Deal.DealStatus.LOST}
    payments = Payment.objects.filter(
        scheduled_date__isnull=False,
        actual_date__isnull=True,
    ).exclude(deal__status__in=closed_statuses)

    for payment in payments:
        if not payment.deal_id:
            continue
        delta_days = (payment.scheduled_date - today).days
        if delta_days < 0 or delta_days > 5:
            continue
        for user in _get_deal_recipients(payment.deal):
            attention_prefix = "Напоминание:"
            if delta_days < 3:
                attention_prefix = f"❗ {attention_prefix}"
            text = _append_link(
                (
                    f"{attention_prefix} до оплаты платежа {payment.amount} руб. "
                    f"по сделке '{_format_deal_title(payment.deal)}' осталось {delta_days} дн."
                ),
                payment.deal.id,
            )
            send_notification(
                user=user,
                text=text,
                event_type="payment_due_reminder",
                object_type="payment",
                object_id=payment.id,
                trigger_date=today,
                setting_attr="notify_payment_due",
            )


def send_policy_expiry_reminders() -> None:
    from apps.policies.models import Policy

    today = timezone.localdate()
    reminder_window = max(_default_remind_days())
    # Policy.status intentionally ignored; reminders rely solely on end_date.
    max_end_date = today + timedelta(days=reminder_window)
    policies = Policy.objects.filter(
        end_date__isnull=False,
        end_date__gte=today,
        end_date__lte=max_end_date,
    ).select_related(
        "deal__seller",
        "deal__executor",
        "client",
        "insured_client",
    )

    for policy in policies:
        delta_days = (policy.end_date - today).days
        if delta_days < 0 or delta_days > reminder_window:
            continue
        client_name = (
            getattr(policy.client, "name", "")
            or getattr(policy.insured_client, "name", "")
            or ""
        )
        formatted_date = _format_date(policy.end_date)
        attention_prefix = "Напоминание:"
        if delta_days < 3:
            attention_prefix = f"❗ {attention_prefix}"
        client_part = f" Клиент: {client_name}" if client_name else ""
        text = _append_link(
            (
                f"{attention_prefix} срок действия полиса {policy.number} "
                f"заканчивается {formatted_date}, осталось {delta_days} дн.{client_part}"
            ),
            policy.deal_id,
        )
        for user in _get_deal_recipients(policy.deal):
            send_notification(
                user=user,
                text=text,
                event_type="policy_expiry_reminder",
                object_type="policy",
                object_id=policy.id,
                trigger_date=today,
                setting_attr="notify_policy_expiry",
            )


def _get_deal_recipients(deal) -> list:
    users = []
    seller = getattr(deal, "seller", None)
    executor = getattr(deal, "executor", None)
    if seller:
        users.append(seller)
    if executor and executor != seller:
        users.append(executor)
    return users
