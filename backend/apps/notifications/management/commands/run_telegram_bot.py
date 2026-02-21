import logging
import time

from apps.notifications.models import TelegramProfile
from apps.notifications.telegram_intake import TelegramIntakeService
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

        intake = TelegramIntakeService(client)
        self._sync_bot_commands(client)
        reminder_interval = getattr(settings, "TELEGRAM_REMINDER_INTERVAL", 300)
        last_reminder_run = 0.0
        offset = None

        self.stdout.write("Telegram bot started.")
        while True:
            try:
                updates = client.get_updates(offset=offset)
                for update in updates:
                    offset = update.get("update_id", 0) + 1
                    self._handle_update(client=client, intake=intake, update=update)

                try:
                    intake.finalize_ready_batches()
                except Exception as exc:  # noqa: BLE001
                    logger.warning("Telegram intake batch finalization failed: %s", exc)

                now = time.monotonic()
                if now - last_reminder_run >= reminder_interval:
                    intake.expire_stale_sessions()
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

    def _handle_update(
        self,
        *,
        client,
        intake: TelegramIntakeService,
        update: dict,
    ) -> None:
        callback_query = update.get("callback_query") or {}
        if callback_query:
            self._handle_callback_query(
                client=client, intake=intake, callback=callback_query
            )
            return

        message = update.get("message") or {}
        chat = message.get("chat") or {}
        chat_id = chat.get("id")
        if not chat_id:
            return

        text = str(message.get("text") or "").strip()
        if text.startswith("/start"):
            code = text.split(maxsplit=1)[1] if len(text.split()) > 1 else ""
            self._handle_start(client, int(chat_id), code)
            return

        profile = self._get_profile_by_chat_id(int(chat_id))
        if not profile:
            client.send_message(
                int(chat_id),
                "Сначала привяжите Telegram через /start <код_привязки> из CRM.",
            )
            return

        if text.startswith("/"):
            self._handle_command(
                client=client,
                intake=intake,
                user=profile.user,
                chat_id=int(chat_id),
                text=text,
            )
            return

        chat_type = str(chat.get("type") or "").lower()
        if chat_type and chat_type != "private":
            client.send_message(
                int(chat_id),
                "Intake пока поддерживается только в личном чате с ботом.",
            )
            return

        result = intake.process_message(
            user=profile.user,
            update_id=int(update.get("update_id") or 0),
            chat_id=int(chat_id),
            message=message,
        )
        client.send_message(int(chat_id), result.text, reply_markup=result.reply_markup)

    def _handle_command(
        self,
        *,
        client,
        intake: TelegramIntakeService,
        user,
        chat_id: int,
        text: str,
    ) -> None:
        command_raw = text.split(maxsplit=1)[0]
        command = command_raw.split("@")[0].lower()
        args_text = text[len(command_raw) :].strip()

        if command == "/help":
            client.send_message(chat_id, intake.build_help_message())
            return
        if command == "/pick":
            try:
                index = int(args_text)
            except (TypeError, ValueError):
                client.send_message(chat_id, "Используйте формат: /pick <номер>")
                return
            result = intake.process_pick(user=user, pick_index=index)
            client.send_message(chat_id, result.text, reply_markup=result.reply_markup)
            return
        if command == "/create":
            result = intake.process_create(user=user)
            client.send_message(chat_id, result.text, reply_markup=result.reply_markup)
            return
        if command == "/cancel":
            result = intake.process_cancel(user=user)
            client.send_message(chat_id, result.text, reply_markup=result.reply_markup)
            return
        client.send_message(
            chat_id,
            "Неизвестная команда. Используйте /help для списка доступных команд.",
        )

    def _handle_callback_query(
        self,
        *,
        client,
        intake: TelegramIntakeService,
        callback: dict,
    ) -> None:
        callback_id = callback.get("id")
        data = str(callback.get("data") or "").strip()
        message = callback.get("message") or {}
        chat = message.get("chat") or {}
        chat_id = chat.get("id")
        if not chat_id:
            if callback_id:
                client.answer_callback_query(callback_id, "Чат не найден")
            return

        profile = self._get_profile_by_chat_id(int(chat_id))
        if not profile:
            if callback_id:
                client.answer_callback_query(callback_id, "Сначала привяжите Telegram")
            client.send_message(
                int(chat_id),
                "Сначала привяжите Telegram через /start <код_привязки> из CRM.",
            )
            return

        result = intake.process_callback(user=profile.user, callback_data=data)
        if callback_id:
            client.answer_callback_query(callback_id, result.text[:180])
        client.send_message(int(chat_id), result.text, reply_markup=result.reply_markup)

    def _get_profile_by_chat_id(self, chat_id: int) -> TelegramProfile | None:
        return (
            TelegramProfile.objects.select_related("user")
            .filter(chat_id=chat_id)
            .first()
        )

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
        client.send_message(
            chat_id,
            "Telegram привязан. Включите уведомления в CRM.\n"
            "Для работы с сообщениями используйте /help.",
        )

    def _sync_bot_commands(self, client) -> None:
        commands = [
            {"command": "help", "description": "Справка по командам"},
            {"command": "pick", "description": "Выбрать сделку из списка"},
            {"command": "create", "description": "Создать новую сделку"},
            {"command": "cancel", "description": "Отменить текущий выбор"},
        ]
        if not client.set_my_commands(commands):
            logger.warning(
                "Telegram commands sync failed; bot will continue without stop."
            )
