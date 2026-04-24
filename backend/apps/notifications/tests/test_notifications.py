from datetime import timedelta
from unittest.mock import patch

from apps.clients.models import Client
from apps.deals.models import Deal, InsuranceCompany, InsuranceType
from apps.finances.models import Payment
from apps.notifications.management.commands.run_telegram_bot import Command
from apps.notifications.models import (
    NotificationDelivery,
    NotificationSettings,
    TelegramDealRoutingSession,
    TelegramInboundMessage,
    TelegramProfile,
)
from apps.notifications.telegram_notifications import (
    send_expected_close_reminders,
    send_payment_due_reminders,
    send_policy_expiry_reminders,
)
from apps.policies.models import Policy
from apps.tasks.models import Task
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

User = get_user_model()


class FakeTelegramClient:
    def __init__(self, file_payloads=None):
        self.file_payloads = file_payloads or {}
        self.sent_messages = []
        self.edited_messages = []
        self.commands = []
        self._next_message_id = 10_000

    def send_message(self, chat_id: int, text: str, reply_markup=None):
        self._next_message_id += 1
        self.sent_messages.append(
            {
                "chat_id": chat_id,
                "text": text,
                "reply_markup": reply_markup,
                "message_id": self._next_message_id,
            }
        )
        return self._next_message_id

    def edit_message_text(
        self, chat_id: int, message_id: int, text: str, reply_markup=None
    ):
        self.edited_messages.append(
            {
                "chat_id": chat_id,
                "message_id": message_id,
                "text": text,
                "reply_markup": reply_markup,
            }
        )
        return True

    def get_file(self, file_id: str):
        if file_id not in self.file_payloads:
            return {"file_path": ""}
        return {"file_path": f"files/{file_id}.bin"}

    def download_file(self, file_path: str):
        file_id = file_path.split("/")[-1].split(".")[0]
        return self.file_payloads.get(file_id)

    def set_my_commands(self, commands: list[dict[str, str]]):
        self.commands = commands
        return True


class FakeCallbackClient:
    def __init__(self):
        self.sent_messages = []
        self.answered_callbacks = []

    def send_message(self, chat_id: int, text: str, reply_markup=None):
        self.sent_messages.append(
            {"chat_id": chat_id, "text": text, "reply_markup": reply_markup}
        )

    def answer_callback_query(self, callback_query_id: str, text: str = ""):
        self.answered_callbacks.append(
            {"callback_query_id": callback_query_id, "text": text}
        )
        return True


class TelegramBotCommandTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="callback-user")
        TelegramProfile.objects.create(user=self.user, chat_id=2001)

    def test_plain_message_after_linking_does_not_create_intake_records(self):
        command = Command()
        fake_client = FakeCallbackClient()

        command._handle_update(
            client=fake_client,
            update={
                "update_id": 1,
                "message": {
                    "message_id": 10,
                    "text": "документы по сделке",
                    "chat": {"id": 2001, "type": "private"},
                },
            },
        )

        self.assertEqual(len(fake_client.sent_messages), 1)
        self.assertIn(
            "только для уведомлений CRM", fake_client.sent_messages[0]["text"]
        )
        self.assertFalse(TelegramInboundMessage.objects.exists())
        self.assertFalse(TelegramDealRoutingSession.objects.exists())

    def test_help_contains_only_notification_bot_commands(self):
        command = Command()
        fake_client = FakeCallbackClient()

        command._handle_command(
            client=fake_client,
            chat_id=2001,
            text="/help",
        )

        self.assertEqual(len(fake_client.sent_messages), 1)
        help_text = fake_client.sent_messages[0]["text"]
        self.assertIn("/help - справка", help_text)
        self.assertIn("только для уведомлений CRM", help_text)
        self.assertNotIn("/pick", help_text)
        self.assertNotIn("/create", help_text)
        self.assertNotIn("/find", help_text)

    def test_callback_reports_disabled_intake_flow(self):
        command = Command()
        fake_client = FakeCallbackClient()

        command._handle_callback_query(
            client=fake_client,
            callback={
                "id": "cb-1",
                "data": "tgintake:send_now:1",
                "message": {"chat": {"id": 2001}},
            },
        )

        self.assertEqual(len(fake_client.answered_callbacks), 1)
        self.assertEqual(len(fake_client.sent_messages), 1)
        self.assertIn(
            "только для уведомлений CRM", fake_client.sent_messages[0]["text"]
        )

    def test_sync_bot_commands_keeps_only_help(self):
        command = Command()
        fake_client = FakeTelegramClient()

        command._sync_bot_commands(fake_client)

        self.assertEqual(
            fake_client.commands,
            [{"command": "help", "description": "Справка по командам"}],
        )


@override_settings(TELEGRAM_BOT_TOKEN="test-token")
class TaskCompletionTelegramNotificationTests(TestCase):
    def setUp(self):
        self.creator = User.objects.create_user(username="task-creator")
        self.executor = User.objects.create_user(username="task-executor")
        self.client_obj = Client.objects.create(
            name="Тестовый клиент",
            created_by=self.creator,
        )
        self.deal = Deal.objects.create(
            title="Сделка по задаче",
            client=self.client_obj,
            seller=self.creator,
            executor=self.executor,
            status=Deal.DealStatus.OPEN,
        )
        TelegramProfile.objects.create(user=self.creator, chat_id=3001)
        NotificationSettings.objects.create(
            user=self.creator,
            telegram_enabled=True,
            notify_tasks=True,
        )
        self.fake_tg = FakeTelegramClient()

    def _create_task(self, **kwargs):
        payload = {
            "deal": self.deal,
            "title": "Проверить договор",
            "created_by": self.creator,
            "assignee": self.executor,
            "status": Task.TaskStatus.TODO,
        }
        payload.update(kwargs)
        with patch(
            "apps.notifications.telegram_notifications.get_telegram_client",
            return_value=self.fake_tg,
        ):
            return Task.objects.create(**payload)

    def test_sends_notification_when_task_changes_from_todo_to_done(self):
        task = self._create_task()

        with patch(
            "apps.notifications.telegram_notifications.get_telegram_client",
            return_value=self.fake_tg,
        ):
            task.status = Task.TaskStatus.DONE
            task.completed_at = timezone.now()
            task.completed_by = self.executor
            task.save(update_fields=["status", "completed_at", "completed_by"])

        self.assertEqual(len(self.fake_tg.sent_messages), 1)
        completion_message = self.fake_tg.sent_messages[0]
        self.assertEqual(completion_message["chat_id"], 3001)
        self.assertIn("✅", completion_message["text"])
        self.assertIn("Задача выполнена", completion_message["text"])
        self.assertIn("Проверить договор", completion_message["text"])
        self.assertEqual(
            NotificationDelivery.objects.filter(
                user=self.creator,
                event_type="task_completed",
                object_type="task",
                object_id=str(task.id),
            ).count(),
            1,
        )

    def test_does_not_send_completion_notification_on_create_with_done_status(self):
        with patch(
            "apps.notifications.telegram_notifications.get_telegram_client",
            return_value=self.fake_tg,
        ):
            self._create_task(
                status=Task.TaskStatus.DONE,
                completed_at=timezone.now(),
                completed_by=self.executor,
            )

        self.assertEqual(len(self.fake_tg.sent_messages), 0)
        self.assertFalse(
            NotificationDelivery.objects.filter(event_type="task_completed").exists()
        )

    def test_does_not_send_when_status_is_saved_without_transition_to_done(self):
        task = self._create_task()

        with patch(
            "apps.notifications.telegram_notifications.get_telegram_client",
            return_value=self.fake_tg,
        ):
            task.title = "Проверить договор срочно"
            task.save(update_fields=["title"])

        self.assertEqual(len(self.fake_tg.sent_messages), 0)
        self.assertFalse(
            NotificationDelivery.objects.filter(event_type="task_completed").exists()
        )

    def test_sends_again_after_reopen_and_second_completion(self):
        task = self._create_task()

        with patch(
            "apps.notifications.telegram_notifications.get_telegram_client",
            return_value=self.fake_tg,
        ):
            task.status = Task.TaskStatus.DONE
            task.completed_at = timezone.now()
            task.completed_by = self.executor
            task.save(update_fields=["status", "completed_at", "completed_by"])

            task.status = Task.TaskStatus.TODO
            task.completed_at = None
            task.completed_by = None
            task.save(update_fields=["status", "completed_at", "completed_by"])

            task.status = Task.TaskStatus.DONE
            task.completed_at = timezone.now() + timedelta(days=1)
            task.completed_by = self.executor
            task.save(update_fields=["status", "completed_at", "completed_by"])

        self.assertEqual(
            NotificationDelivery.objects.filter(
                user=self.creator,
                event_type="task_completed",
                object_type="task",
                object_id=str(task.id),
            ).count(),
            2,
        )
        self.assertEqual(len(self.fake_tg.sent_messages), 2)

    def test_does_not_send_when_task_notifications_are_disabled(self):
        task = self._create_task()
        settings_obj = self.creator.notification_settings
        settings_obj.notify_tasks = False
        settings_obj.save(update_fields=["notify_tasks"])

        with patch(
            "apps.notifications.telegram_notifications.get_telegram_client",
            return_value=self.fake_tg,
        ):
            task.status = Task.TaskStatus.DONE
            task.completed_at = timezone.now()
            task.completed_by = self.executor
            task.save(update_fields=["status", "completed_at", "completed_by"])

        self.assertEqual(len(self.fake_tg.sent_messages), 0)
        self.assertFalse(
            NotificationDelivery.objects.filter(event_type="task_completed").exists()
        )

    def test_does_not_send_when_telegram_is_disabled(self):
        task = self._create_task()
        settings_obj = self.creator.notification_settings
        settings_obj.telegram_enabled = False
        settings_obj.save(update_fields=["telegram_enabled"])

        with patch(
            "apps.notifications.telegram_notifications.get_telegram_client",
            return_value=self.fake_tg,
        ):
            task.status = Task.TaskStatus.DONE
            task.completed_at = timezone.now()
            task.completed_by = self.executor
            task.save(update_fields=["status", "completed_at", "completed_by"])

        self.assertEqual(len(self.fake_tg.sent_messages), 0)
        self.assertFalse(
            NotificationDelivery.objects.filter(event_type="task_completed").exists()
        )

    def test_does_not_send_without_creator_or_chat_binding(self):
        task_without_creator = self._create_task(created_by=None)
        task_without_chat = self._create_task(title="Без привязки")
        self.creator.telegram_profile.chat_id = None
        self.creator.telegram_profile.save(update_fields=["chat_id"])

        with patch(
            "apps.notifications.telegram_notifications.get_telegram_client",
            return_value=self.fake_tg,
        ):
            task_without_creator.status = Task.TaskStatus.DONE
            task_without_creator.completed_at = timezone.now()
            task_without_creator.completed_by = self.executor
            task_without_creator.save(
                update_fields=["status", "completed_at", "completed_by"]
            )

            task_without_chat.status = Task.TaskStatus.DONE
            task_without_chat.completed_at = timezone.now()
            task_without_chat.completed_by = self.executor
            task_without_chat.save(
                update_fields=["status", "completed_at", "completed_by"]
            )

        self.assertEqual(len(self.fake_tg.sent_messages), 0)
        self.assertFalse(
            NotificationDelivery.objects.filter(event_type="task_completed").exists()
        )

    def test_existing_task_created_notification_still_works(self):
        TelegramProfile.objects.create(user=self.executor, chat_id=3002)
        NotificationSettings.objects.create(
            user=self.executor,
            telegram_enabled=True,
            notify_tasks=True,
        )

        self._create_task(title="Новая задача исполнителю")

        self.assertEqual(len(self.fake_tg.sent_messages), 1)
        self.assertEqual(self.fake_tg.sent_messages[0]["chat_id"], 3002)
        self.assertIn("🟢", self.fake_tg.sent_messages[0]["text"])
        self.assertIn("Новая задача", self.fake_tg.sent_messages[0]["text"])
        self.assertTrue(
            NotificationDelivery.objects.filter(
                user=self.executor,
                event_type="task_created",
            ).exists()
        )


class TelegramReminderEmojiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="reminder-user")
        self.client_obj = Client.objects.create(
            name="Клиент напоминаний",
            created_by=self.user,
        )
        self.deal = Deal.objects.create(
            title="Сделка напоминаний",
            client=self.client_obj,
            seller=self.user,
            status=Deal.DealStatus.OPEN,
            stage_name="initial",
        )

    def test_expected_close_uses_regular_and_urgent_emoji(self):
        today = timezone.localdate()
        self.deal.expected_close = today + timedelta(days=5)
        self.deal.save(update_fields=["expected_close", "updated_at"])

        with patch(
            "apps.notifications.telegram_notifications.send_notification"
        ) as send_notification_mock:
            send_expected_close_reminders()

        self.assertIn("🔔 Внимание!", send_notification_mock.call_args.kwargs["text"])

        send_notification_mock.reset_mock()
        self.deal.expected_close = today + timedelta(days=1)
        self.deal.save(update_fields=["expected_close", "updated_at"])

        with patch(
            "apps.notifications.telegram_notifications.send_notification"
        ) as send_notification_mock:
            send_expected_close_reminders()

        self.assertIn("🚨 Внимание!", send_notification_mock.call_args.kwargs["text"])

    def test_payment_due_uses_regular_and_urgent_emoji(self):
        today = timezone.localdate()
        payment = Payment.objects.create(
            deal=self.deal,
            amount=2300,
            scheduled_date=today + timedelta(days=5),
        )

        with patch(
            "apps.notifications.telegram_notifications.send_notification"
        ) as send_notification_mock:
            send_payment_due_reminders()

        self.assertIn(
            "💸 Напоминание:", send_notification_mock.call_args.kwargs["text"]
        )

        send_notification_mock.reset_mock()
        payment.scheduled_date = today + timedelta(days=1)
        payment.save(update_fields=["scheduled_date", "updated_at"])

        with patch(
            "apps.notifications.telegram_notifications.send_notification"
        ) as send_notification_mock:
            send_payment_due_reminders()

        self.assertIn(
            "🚨 Напоминание:", send_notification_mock.call_args.kwargs["text"]
        )

    def test_policy_expiry_uses_regular_and_urgent_emoji(self):
        today = timezone.localdate()
        company = InsuranceCompany.objects.create(name="Reminder company")
        insurance_type = InsuranceType.objects.create(name="Reminder type")
        policy = Policy.objects.create(
            number="POL-EMOJI",
            deal=self.deal,
            insurance_company=company,
            insurance_type=insurance_type,
            client=self.client_obj,
            end_date=today + timedelta(days=5),
        )

        with patch(
            "apps.notifications.telegram_notifications.send_notification"
        ) as send_notification_mock:
            send_policy_expiry_reminders()

        self.assertIn("🛡️ Напоминание:", send_notification_mock.call_args.kwargs["text"])

        send_notification_mock.reset_mock()
        policy.end_date = today + timedelta(days=1)
        policy.save(update_fields=["end_date", "updated_at"])

        with patch(
            "apps.notifications.telegram_notifications.send_notification"
        ) as send_notification_mock:
            send_policy_expiry_reminders()

        self.assertIn(
            "🚨 Напоминание:", send_notification_mock.call_args.kwargs["text"]
        )


class DriveReconnectApiTests(TestCase):
    def setUp(self):
        self.vova = User.objects.create_user(username="Vova")
        self.other = User.objects.create_user(username="other-drive")
        self.api_client = APIClient()

    def test_notification_settings_response_includes_drive_status(self):
        self.api_client.force_authenticate(self.vova)
        with patch(
            "apps.notifications.views.get_drive_status_for_user",
            return_value={
                "status": "connected",
                "auth_mode": "auto",
                "using_fallback": False,
                "reconnect_available": True,
                "last_checked_at": "2026-03-08T12:00:00Z",
                "last_error_code": "",
                "last_error_message": "",
                "active_auth_type": "oauth",
            },
        ):
            response = self.api_client.get("/api/v1/notifications/settings/")

        self.assertEqual(response.status_code, 200)
        self.assertIn("drive", response.data)
        self.assertEqual(response.data["drive"]["status"], "connected")

    def test_drive_reconnect_is_restricted_to_vova(self):
        self.api_client.force_authenticate(self.other)

        response = self.api_client.post(
            "/api/v1/notifications/settings/drive-reconnect/",
            data={},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("Vova", response.data["detail"])

    def test_drive_reconnect_returns_google_auth_url_for_vova(self):
        self.api_client.force_authenticate(self.vova)
        with patch(
            "apps.notifications.views.build_reconnect_url",
            return_value="https://accounts.google.com/o/oauth2/v2/auth?state=test",
        ):
            response = self.api_client.post(
                "/api/v1/notifications/settings/drive-reconnect/",
                data={},
                format="json",
            )

        self.assertEqual(response.status_code, 200)
        self.assertIn("https://accounts.google.com", response.data["auth_url"])
