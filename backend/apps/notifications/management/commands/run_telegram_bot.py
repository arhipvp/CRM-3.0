import logging
import time

from apps.notifications.models import TelegramProfile
from apps.notifications.telegram_notifications import (
    get_or_create_settings,
    get_telegram_client,
    send_expected_close_reminders,
    send_payment_due_reminders,
    send_policy_expiry_reminders,
)
from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Run Telegram bot long polling and reminders."

    def handle(self, *args, **options):
        client = get_telegram_client()
        if client is None:
            self.stderr.write("TELEGRAM_BOT_TOKEN is not configured.")
            return

        reminder_interval = getattr(settings, "TELEGRAM_REMINDER_INTERVAL", 300)
        last_reminder_run = 0.0
        offset = None

        self.stdout.write("Telegram bot started.")
        while True:
            try:
                updates = client.get_updates(offset=offset)
                for update in updates:
                    offset = update.get("update_id", 0) + 1
                    self._handle_update(client, update)

                now = time.monotonic()
                if now - last_reminder_run >= reminder_interval:
                    send_expected_close_reminders()
                    send_payment_due_reminders()
                    send_policy_expiry_reminders()
                    last_reminder_run = now
            except KeyboardInterrupt:
                self.stdout.write("Telegram bot stopped.")
                break
            except Exception as exc:  # noqa: BLE001
                logger.exception("Telegram bot loop error: %s", exc)
                time.sleep(2)

    def _handle_update(self, client, update: dict) -> None:
        message = update.get("message") or {}
        chat = message.get("chat") or {}
        chat_id = chat.get("id")
        text = message.get("text") or ""
        if not chat_id or not text:
            return

        if text.startswith("/start"):
            code = text.split(maxsplit=1)[1] if len(text.split()) > 1 else ""
            self._handle_start(client, chat_id, code)

    def _handle_start(self, client, chat_id: int, code: str) -> None:
        if not code:
            client.send_message(chat_id, "Отправьте код привязки из настроек CRM.")
            return

        now = timezone.now()
        profile = (
            TelegramProfile.objects.select_related("user")
            .filter(link_code=code, link_code_expires_at__gt=now)
            .first()
        )
        if not profile:
            client.send_message(chat_id, "Код привязки не найден или истек.")
            return

        if (
            TelegramProfile.objects.filter(chat_id=chat_id)
            .exclude(user=profile.user)
            .exists()
        ):
            client.send_message(
                chat_id, "Этот Telegram уже привязан к другому пользователю."
            )
            return

        profile.chat_id = chat_id
        profile.linked_at = now
        profile.link_code = ""
        profile.link_code_expires_at = None
        profile.save(
            update_fields=["chat_id", "linked_at", "link_code", "link_code_expires_at"]
        )

        get_or_create_settings(profile.user)
        client.send_message(chat_id, "Telegram привязан. Включите уведомления в CRM.")
