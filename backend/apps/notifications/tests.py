import json
import shutil
import tempfile
from datetime import timedelta
from unittest.mock import patch

from apps.clients.models import Client
from apps.common.drive import DriveConfigurationError, DriveOperationError
from apps.deals.models import Deal
from apps.documents.models import Document
from apps.notes.models import Note
from apps.notifications.models import (
    TelegramDealRoutingSession,
    TelegramInboundMessage,
    TelegramProfile,
)
from apps.notifications.telegram_intake import TelegramIntakeService
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


class TelegramIntakeServiceTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="seller", password="pass")
        self.other_user = User.objects.create_user(username="other", password="pass")
        TelegramProfile.objects.create(user=self.user, chat_id=1001)

        self.client_obj = Client.objects.create(
            name="Иван Иванов",
            phone="+7 (999) 111-22-33",
            email="ivan@example.com",
            created_by=self.user,
        )
        self.deal = Deal.objects.create(
            title="Текущая сделка",
            client=self.client_obj,
            seller=self.user,
            status=Deal.DealStatus.OPEN,
        )
        self.fake_tg = FakeTelegramClient()
        self.service = TelegramIntakeService(self.fake_tg)

    def test_four_documents_form_one_batch(self):
        for idx in range(1, 5):
            result = self.service.process_message(
                user=self.user,
                update_id=idx,
                chat_id=1001,
                message={
                    "message_id": 500 + idx,
                    "text": "",
                    "chat": {"id": 1001, "type": "private"},
                    "document": {
                        "file_id": f"doc_{idx}",
                        "file_name": f"doc_{idx}.pdf",
                        "mime_type": "application/pdf",
                    },
                },
            )
            self.assertIn("Добавлено в пакет", result.text)
            self.assertTrue(result.already_sent)

        session = TelegramDealRoutingSession.objects.get(user=self.user)
        self.assertEqual(session.state, TelegramDealRoutingSession.State.COLLECTING)
        self.assertEqual(len(session.batch_message_ids), 4)
        self.assertEqual(len(session.aggregated_attachments), 4)
        self.assertIsNotNone(session.status_message_id)
        self.assertEqual(len(self.fake_tg.sent_messages), 1)
        self.assertEqual(len(self.fake_tg.edited_messages), 3)
        self.assertEqual(
            TelegramInboundMessage.objects.filter(routing_session=session).count(), 4
        )

    def test_finalize_timeout_sends_single_decision_prompt(self):
        self.service.process_message(
            user=self.user,
            update_id=1,
            chat_id=1001,
            message={
                "message_id": 610,
                "text": "Телефон: +7 (999) 111-22-33",
                "chat": {"id": 1001, "type": "private"},
            },
        )
        session = TelegramDealRoutingSession.objects.get(user=self.user)
        session.last_message_at = timezone.now() - timedelta(seconds=61)
        session.save(update_fields=["last_message_at"])

        sent_count = self.service.finalize_ready_batches()
        self.assertEqual(sent_count, 1)
        session.refresh_from_db()
        self.assertEqual(session.state, TelegramDealRoutingSession.State.READY)
        self.assertIsNotNone(session.decision_prompt_sent_at)
        self.assertEqual(len(self.fake_tg.sent_messages), 1)

        sent_count_again = self.service.finalize_ready_batches()
        self.assertEqual(sent_count_again, 0)
        self.assertEqual(len(self.fake_tg.sent_messages), 1)

    def test_create_from_ready_batch_creates_single_note_and_all_documents(self):
        media_root = tempfile.mkdtemp(prefix="tg-intake-test-")
        try:
            self.fake_tg = FakeTelegramClient(
                file_payloads={
                    "doc_1": b"one",
                    "doc_2": b"two",
                    "doc_3": b"three",
                    "doc_4": b"four",
                }
            )
            self.service = TelegramIntakeService(self.fake_tg)

            for idx in range(1, 5):
                self.service.process_message(
                    user=self.user,
                    update_id=idx,
                    chat_id=1001,
                    message={
                        "message_id": 700 + idx,
                        "chat": {"id": 1001, "type": "private"},
                        "document": {
                            "file_id": f"doc_{idx}",
                            "file_name": f"doc_{idx}.pdf",
                            "mime_type": "application/pdf",
                        },
                    },
                )

            session = TelegramDealRoutingSession.objects.get(user=self.user)
            session.last_message_at = timezone.now() - timedelta(seconds=61)
            session.save(update_fields=["last_message_at"])
            self.service.finalize_ready_batches()

            with override_settings(MEDIA_ROOT=media_root):
                result = self.service.process_create(user=self.user)
            self.assertIn("Создана новая сделка", result.text)

            session.refresh_from_db()
            self.assertEqual(
                session.state, TelegramDealRoutingSession.State.CREATED_NEW_DEAL
            )
            created_deal = session.created_deal
            self.assertIsNotNone(created_deal)
            self.assertEqual(Document.objects.filter(deal=created_deal).count(), 4)
            self.assertEqual(Note.objects.filter(deal=created_deal).count(), 1)
        finally:
            shutil.rmtree(media_root, ignore_errors=True)


class TelegramIntakeDriveUploadApiTests(TestCase):
    def setUp(self):
        self.api_client = APIClient()
        self.user = User.objects.create_user(username="api_user", password="pass")
        self.client_obj = Client.objects.create(name="API Client", created_by=self.user)
        self.deal = Deal.objects.create(
            title="API Deal",
            client=self.client_obj,
            seller=self.user,
            status=Deal.DealStatus.OPEN,
        )

    def test_requires_internal_token(self):
        response = self.api_client.post(
            "/api/v1/notifications/telegram-intake/upload-drive/",
            data={},
            format="json",
        )
        self.assertEqual(response.status_code, 403)

    def test_uploads_file_with_valid_internal_token(self):
        payload = {
            "user_id": str(self.user.id),
            "deal_id": str(self.deal.id),
            "file_name": "api.pdf",
            "mime_type": "application/pdf",
            "content_base64": "MQ==",
        }
        with (
            override_settings(TELEGRAM_INTERNAL_API_TOKEN="internal-token"),
            patch(
                "apps.notifications.views.ensure_deal_folder",
                return_value="deal-folder",
            ),
            patch("apps.notifications.views.upload_file_to_drive") as upload_mock,
        ):
            upload_mock.return_value = {
                "id": "file123",
                "name": "api.pdf",
                "mime_type": "application/pdf",
                "size": 1,
                "created_at": None,
                "modified_at": None,
                "web_view_link": None,
                "is_folder": False,
            }
            response = self.api_client.post(
                "/api/v1/notifications/telegram-intake/upload-drive/",
                data=payload,
                format="json",
                HTTP_X_TELEGRAM_INTERNAL_TOKEN="internal-token",
            )
        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data["ok"])
        self.assertEqual(upload_mock.call_count, 1)

    def test_pick_from_ready_batch_links_all_documents_and_single_note(self):
        media_root = tempfile.mkdtemp(prefix="tg-intake-test-")
        try:
            self.fake_tg = FakeTelegramClient(
                file_payloads={"doc_ok_1": b"1", "doc_ok_2": b"2"}
            )
            self.service = TelegramIntakeService(self.fake_tg)
            self.service.process_message(
                user=self.user,
                update_id=1,
                chat_id=1001,
                message={
                    "message_id": 801,
                    "text": "Клиент: Иван Иванов\nТелефон: +7 (999) 111-22-33",
                    "chat": {"id": 1001, "type": "private"},
                    "document": {
                        "file_id": "doc_ok_1",
                        "file_name": "a.pdf",
                        "mime_type": "application/pdf",
                    },
                },
            )
            self.service.process_message(
                user=self.user,
                update_id=2,
                chat_id=1001,
                message={
                    "message_id": 802,
                    "text": "",
                    "chat": {"id": 1001, "type": "private"},
                    "document": {
                        "file_id": "doc_ok_2",
                        "file_name": "b.pdf",
                        "mime_type": "application/pdf",
                    },
                },
            )
            session = TelegramDealRoutingSession.objects.get(user=self.user)
            session.last_message_at = timezone.now() - timedelta(seconds=61)
            session.save(update_fields=["last_message_at"])
            self.service.finalize_ready_batches()
            with override_settings(MEDIA_ROOT=media_root):
                result = self.service.process_pick(user=self.user, pick_index=1)
            self.assertIn("Пакет привязан", result.text)
            self.assertEqual(Document.objects.filter(deal=self.deal).count(), 2)
            self.assertEqual(Note.objects.filter(deal=self.deal).count(), 1)
        finally:
            shutil.rmtree(media_root, ignore_errors=True)

    def test_pick_uploads_telegram_attachments_to_drive(self):
        media_root = tempfile.mkdtemp(prefix="tg-intake-test-")
        try:
            self.fake_tg = FakeTelegramClient(
                file_payloads={"doc_ok_1": b"1", "doc_ok_2": b"2"}
            )
            self.service = TelegramIntakeService(self.fake_tg)
            self.service.process_message(
                user=self.user,
                update_id=1,
                chat_id=1001,
                message={
                    "message_id": 811,
                    "text": "Документы по сделке",
                    "chat": {"id": 1001, "type": "private"},
                    "document": {
                        "file_id": "doc_ok_1",
                        "file_name": "a.pdf",
                        "mime_type": "application/pdf",
                    },
                },
            )
            self.service.process_message(
                user=self.user,
                update_id=2,
                chat_id=1001,
                message={
                    "message_id": 812,
                    "text": "",
                    "chat": {"id": 1001, "type": "private"},
                    "document": {
                        "file_id": "doc_ok_2",
                        "file_name": "b.pdf",
                        "mime_type": "application/pdf",
                    },
                },
            )

            session = TelegramDealRoutingSession.objects.get(user=self.user)
            session.last_message_at = timezone.now() - timedelta(seconds=61)
            session.save(update_fields=["last_message_at"])
            self.service.finalize_ready_batches()

            with (
                override_settings(MEDIA_ROOT=media_root),
                patch(
                    "apps.notifications.telegram_intake.ensure_deal_folder",
                    return_value="deal-folder-1",
                ),
                patch(
                    "apps.notifications.telegram_intake.upload_file_to_drive"
                ) as upload_mock,
            ):
                result = self.service.process_pick(user=self.user, pick_index=1)

            self.assertIn("Сохранено файлов: 2.", result.text)
            self.assertEqual(upload_mock.call_count, 2)
        finally:
            shutil.rmtree(media_root, ignore_errors=True)

    def test_pick_reports_drive_configuration_error_in_result_text(self):
        media_root = tempfile.mkdtemp(prefix="tg-intake-test-")
        try:
            self.fake_tg = FakeTelegramClient(file_payloads={"doc_cfg_1": b"1"})
            self.service = TelegramIntakeService(self.fake_tg)
            self.service.process_message(
                user=self.user,
                update_id=1,
                chat_id=1001,
                message={
                    "message_id": 813,
                    "chat": {"id": 1001, "type": "private"},
                    "document": {
                        "file_id": "doc_cfg_1",
                        "file_name": "cfg.pdf",
                        "mime_type": "application/pdf",
                    },
                },
            )
            session = TelegramDealRoutingSession.objects.get(user=self.user)
            session.last_message_at = timezone.now() - timedelta(seconds=61)
            session.save(update_fields=["last_message_at"])
            self.service.finalize_ready_batches()

            with (
                override_settings(MEDIA_ROOT=media_root),
                patch(
                    "apps.notifications.telegram_intake.ensure_deal_folder",
                    side_effect=DriveConfigurationError("Drive is not configured"),
                ),
            ):
                result = self.service.process_pick(user=self.user, pick_index=1)

            self.assertIn("Ошибки файлов: 1", result.text)
            self.assertIn(
                "внутренняя интеграция Google Drive не настроена", result.text
            )
        finally:
            shutil.rmtree(media_root, ignore_errors=True)

    def test_pick_reports_drive_upload_error_in_result_text(self):
        media_root = tempfile.mkdtemp(prefix="tg-intake-test-")
        try:
            self.fake_tg = FakeTelegramClient(file_payloads={"doc_op_1": b"1"})
            self.service = TelegramIntakeService(self.fake_tg)
            self.service.process_message(
                user=self.user,
                update_id=1,
                chat_id=1001,
                message={
                    "message_id": 814,
                    "chat": {"id": 1001, "type": "private"},
                    "document": {
                        "file_id": "doc_op_1",
                        "file_name": "op.pdf",
                        "mime_type": "application/pdf",
                    },
                },
            )
            session = TelegramDealRoutingSession.objects.get(user=self.user)
            session.last_message_at = timezone.now() - timedelta(seconds=61)
            session.save(update_fields=["last_message_at"])
            self.service.finalize_ready_batches()

            with (
                override_settings(MEDIA_ROOT=media_root),
                patch(
                    "apps.notifications.telegram_intake.ensure_deal_folder",
                    return_value="deal-folder-1",
                ),
                patch(
                    "apps.notifications.telegram_intake.upload_file_to_drive",
                    side_effect=DriveOperationError(
                        "Unable to upload file to Google Drive."
                    ),
                ),
            ):
                result = self.service.process_pick(user=self.user, pick_index=1)

            self.assertIn("Ошибки файлов: 1", result.text)
            self.assertIn("файл не удалось загрузить в Google Drive", result.text)
        finally:
            shutil.rmtree(media_root, ignore_errors=True)

    def test_pick_uploads_via_backend_internal_api(self):
        media_root = tempfile.mkdtemp(prefix="tg-intake-test-")
        try:
            self.fake_tg = FakeTelegramClient(file_payloads={"doc_api_1": b"1"})
            self.service = TelegramIntakeService(self.fake_tg)
            self.service.process_message(
                user=self.user,
                update_id=1,
                chat_id=1001,
                message={
                    "message_id": 815,
                    "chat": {"id": 1001, "type": "private"},
                    "document": {
                        "file_id": "doc_api_1",
                        "file_name": "api.pdf",
                        "mime_type": "application/pdf",
                    },
                },
            )
            session = TelegramDealRoutingSession.objects.get(user=self.user)
            session.last_message_at = timezone.now() - timedelta(seconds=61)
            session.save(update_fields=["last_message_at"])
            self.service.finalize_ready_batches()

            class FakeHttpResponse:
                def __init__(self, payload: dict):
                    self.status = 201
                    self._payload = payload

                def read(self):
                    return json.dumps(self._payload).encode("utf-8")

                def __enter__(self):
                    return self

                def __exit__(self, exc_type, exc, tb):
                    return False

            with (
                override_settings(
                    MEDIA_ROOT=media_root,
                    TELEGRAM_INTERNAL_API_URL="http://backend:8000",
                    TELEGRAM_INTERNAL_API_TOKEN="internal-token",
                ),
                patch(
                    "apps.notifications.telegram_intake.urllib.request.urlopen",
                    return_value=FakeHttpResponse({"ok": True}),
                ) as urlopen_mock,
                patch(
                    "apps.notifications.telegram_intake.ensure_deal_folder"
                ) as ensure_mock,
                patch(
                    "apps.notifications.telegram_intake.upload_file_to_drive"
                ) as upload_mock,
            ):
                result = self.service.process_pick(user=self.user, pick_index=1)

            self.assertIn("Сохранено файлов: 1.", result.text)
            self.assertEqual(urlopen_mock.call_count, 1)
            ensure_mock.assert_not_called()
            upload_mock.assert_not_called()
        finally:
            shutil.rmtree(media_root, ignore_errors=True)

    def test_new_message_after_ready_starts_new_batch(self):
        self.service.process_message(
            user=self.user,
            update_id=1,
            chat_id=1001,
            message={"message_id": 901, "chat": {"id": 1001, "type": "private"}},
        )
        first_session = TelegramDealRoutingSession.objects.get(user=self.user)
        first_session.last_message_at = timezone.now() - timedelta(seconds=61)
        first_session.save(update_fields=["last_message_at"])
        self.service.finalize_ready_batches()
        first_session.refresh_from_db()
        self.assertEqual(first_session.state, TelegramDealRoutingSession.State.READY)

        self.service.process_message(
            user=self.user,
            update_id=2,
            chat_id=1001,
            message={"message_id": 902, "chat": {"id": 1001, "type": "private"}},
        )
        second_session = (
            TelegramDealRoutingSession.objects.filter(user=self.user)
            .order_by("-created_at")
            .first()
        )
        self.assertIsNotNone(second_session)
        self.assertNotEqual(first_session.id, second_session.id)
        self.assertEqual(
            second_session.state, TelegramDealRoutingSession.State.COLLECTING
        )

    def test_candidate_search_is_limited_to_user_access(self):
        inaccessible_deal = Deal.objects.create(
            title="Чужая сделка",
            client=self.client_obj,
            seller=self.other_user,
            status=Deal.DealStatus.OPEN,
        )
        self.service.process_message(
            user=self.user,
            update_id=1,
            chat_id=1001,
            message={
                "message_id": 920,
                "text": "Клиент: Иван Иванов\nТелефон: +7 (999) 111-22-33",
                "chat": {"id": 1001, "type": "private"},
            },
        )
        session = TelegramDealRoutingSession.objects.get(user=self.user)
        session.last_message_at = timezone.now() - timedelta(seconds=61)
        session.save(update_fields=["last_message_at"])
        self.service.finalize_ready_batches()
        session.refresh_from_db()
        self.assertIn(str(self.deal.id), session.candidate_deal_ids)
        self.assertNotIn(str(inaccessible_deal.id), session.candidate_deal_ids)

    def test_duplicate_message_id_is_idempotent_in_batch(self):
        self.service.process_message(
            user=self.user,
            update_id=1,
            chat_id=1001,
            message={
                "message_id": 930,
                "chat": {"id": 1001, "type": "private"},
                "document": {"file_id": "dup_1", "file_name": "dup.pdf"},
            },
        )
        duplicate = self.service.process_message(
            user=self.user,
            update_id=2,
            chat_id=1001,
            message={
                "message_id": 930,
                "chat": {"id": 1001, "type": "private"},
                "document": {"file_id": "dup_1", "file_name": "dup.pdf"},
            },
        )
        self.assertIn("уже добавлено", duplicate.text)
        session = TelegramDealRoutingSession.objects.get(user=self.user)
        self.assertEqual(len(session.batch_message_ids), 1)
        self.assertEqual(len(session.aggregated_attachments), 1)

    def test_send_now_finishes_collecting_batch_without_waiting_timeout(self):
        self.service.process_message(
            user=self.user,
            update_id=1,
            chat_id=1001,
            message={
                "message_id": 940,
                "text": "Клиент: Иван Иванов\nТелефон: +7 (999) 111-22-33",
                "chat": {"id": 1001, "type": "private"},
            },
        )
        result = self.service.process_send_now(user=self.user)
        self.assertIn("Пакет готов", result.text)
        self.assertIsNotNone(result.reply_markup)
        self.assertTrue(result.already_sent)

        session = TelegramDealRoutingSession.objects.get(user=self.user)
        self.assertEqual(session.state, TelegramDealRoutingSession.State.READY)
        self.assertIsNotNone(session.decision_prompt_sent_at)
        self.assertEqual(len(self.fake_tg.sent_messages), 1)
        self.assertEqual(len(self.fake_tg.edited_messages), 1)

    def test_collecting_status_contains_send_now_button(self):
        self.service.process_message(
            user=self.user,
            update_id=1,
            chat_id=1001,
            message={
                "message_id": 941,
                "text": "первый файл",
                "chat": {"id": 1001, "type": "private"},
            },
        )
        self.assertTrue(self.fake_tg.sent_messages)
        markup = self.fake_tg.sent_messages[-1]["reply_markup"] or {}
        markup_text = str(markup)
        self.assertIn("Отправить немедленно", markup_text)

    def test_ready_prefers_forward_name_match_in_candidates(self):
        forward_client = Client.objects.create(
            name="Петр Петров",
            phone="+7 (901) 000-00-00",
            email="petr@example.com",
            created_by=self.user,
        )
        forward_deal = Deal.objects.create(
            title="Сделка Петра",
            client=forward_client,
            seller=self.user,
            status=Deal.DealStatus.OPEN,
        )

        self.service.process_message(
            user=self.user,
            update_id=1,
            chat_id=1001,
            message={
                "message_id": 950,
                "text": "пакет документов",
                "chat": {"id": 1001, "type": "private"},
                "forward_sender_name": "Петр Петров",
            },
        )
        session = TelegramDealRoutingSession.objects.get(user=self.user)
        session.last_message_at = timezone.now() - timedelta(seconds=61)
        session.save(update_fields=["last_message_at"])

        self.service.finalize_ready_batches()
        session.refresh_from_db()

        self.assertGreaterEqual(len(session.candidate_deal_ids), 1)
        self.assertEqual(session.candidate_deal_ids[0], str(forward_deal.id))

    def test_find_returns_top5_and_updates_pick_list(self):
        for idx in range(6):
            client = Client.objects.create(
                name=f"Клиент КАСКО {idx}",
                created_by=self.user,
            )
            Deal.objects.create(
                title=f"КАСКО договор {idx}",
                client=client,
                seller=self.user,
                status=Deal.DealStatus.OPEN,
            )

        self.service.process_message(
            user=self.user,
            update_id=1,
            chat_id=1001,
            message={
                "message_id": 960,
                "text": "документы",
                "chat": {"id": 1001, "type": "private"},
            },
        )

        result = self.service.process_find(user=self.user, query="каско")
        session = TelegramDealRoutingSession.objects.get(user=self.user)

        self.assertIn("Результаты поиска", result.text)
        self.assertEqual(session.state, TelegramDealRoutingSession.State.READY)
        self.assertEqual(len(session.candidate_deal_ids), 5)

    def test_find_empty_query_returns_usage_hint(self):
        result = self.service.process_find(user=self.user, query="   ")
        self.assertEqual(result.text, "Используйте формат: /find <текст>")

    def test_request_find_enables_plain_text_search_mode(self):
        self.service.process_message(
            user=self.user,
            update_id=1,
            chat_id=1001,
            message={
                "message_id": 965,
                "text": "пакет",
                "chat": {"id": 1001, "type": "private"},
            },
        )

        prompt = self.service.process_request_find(user=self.user)
        self.assertIn("Введите текст для поиска сделки", prompt.text)

        result = self.service.process_message(
            user=self.user,
            update_id=2,
            chat_id=1001,
            message={
                "message_id": 966,
                "text": "Иванов",
                "chat": {"id": 1001, "type": "private"},
            },
        )
        self.assertIn("Результаты поиска", result.text)

    def test_pick_works_after_find_results_replaced(self):
        query_client = Client.objects.create(
            name="Нужный клиент",
            created_by=self.user,
        )
        target_deal = Deal.objects.create(
            title="спец каско сделка",
            client=query_client,
            seller=self.user,
            status=Deal.DealStatus.OPEN,
        )

        self.service.process_message(
            user=self.user,
            update_id=1,
            chat_id=1001,
            message={
                "message_id": 970,
                "text": "Клиент: Иван Иванов",
                "chat": {"id": 1001, "type": "private"},
            },
        )
        find_result = self.service.process_find(user=self.user, query="спец каско")
        self.assertIn("Результаты поиска", find_result.text)

        pick_result = self.service.process_pick(user=self.user, pick_index=1)
        self.assertIn("Пакет привязан", pick_result.text)

        session = TelegramDealRoutingSession.objects.get(user=self.user)
        self.assertEqual(str(session.selected_deal_id), str(target_deal.id))

    def test_pick_callback_uses_explicit_deal_id(self):
        first_client = Client.objects.create(name="Клиент 1", created_by=self.user)
        second_client = Client.objects.create(name="Клиент 2", created_by=self.user)
        first_deal = Deal.objects.create(
            title="Сделка первая",
            client=first_client,
            seller=self.user,
            status=Deal.DealStatus.OPEN,
        )
        second_deal = Deal.objects.create(
            title="Сделка вторая",
            client=second_client,
            seller=self.user,
            status=Deal.DealStatus.OPEN,
        )

        self.service.process_message(
            user=self.user,
            update_id=1,
            chat_id=1001,
            message={
                "message_id": 975,
                "text": "документы",
                "chat": {"id": 1001, "type": "private"},
            },
        )
        session = TelegramDealRoutingSession.objects.get(user=self.user)
        session.state = TelegramDealRoutingSession.State.READY
        session.candidate_deal_ids = [str(first_deal.id), str(second_deal.id)]
        session.save(update_fields=["state", "candidate_deal_ids", "updated_at"])

        result = self.service.process_callback(
            user=self.user,
            callback_data=f"tgintake:pick:{session.id}:{second_deal.id}",
        )
        self.assertIn("Пакет привязан к сделке 'Сделка вторая'", result.text)

    def test_ready_message_contains_find_command_hint(self):
        self.service.process_message(
            user=self.user,
            update_id=1,
            chat_id=1001,
            message={
                "message_id": 980,
                "text": "документы",
                "chat": {"id": 1001, "type": "private"},
            },
        )
        session = TelegramDealRoutingSession.objects.get(user=self.user)
        session.last_message_at = timezone.now() - timedelta(seconds=61)
        session.save(update_fields=["last_message_at"])

        self.service.finalize_ready_batches()
        self.assertTrue(self.fake_tg.edited_messages)
        self.assertIn(
            "Поиск сделки", str(self.fake_tg.edited_messages[-1]["reply_markup"])
        )
