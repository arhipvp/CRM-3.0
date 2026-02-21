import shutil
import tempfile
from datetime import timedelta

from apps.clients.models import Client
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

User = get_user_model()


class FakeTelegramClient:
    def __init__(self, file_payloads=None):
        self.file_payloads = file_payloads or {}
        self.sent_messages = []

    def send_message(self, chat_id: int, text: str, reply_markup=None):
        self.sent_messages.append(
            {"chat_id": chat_id, "text": text, "reply_markup": reply_markup}
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

        session = TelegramDealRoutingSession.objects.get(user=self.user)
        self.assertEqual(session.state, TelegramDealRoutingSession.State.COLLECTING)
        self.assertEqual(len(session.batch_message_ids), 4)
        self.assertEqual(len(session.aggregated_attachments), 4)
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
