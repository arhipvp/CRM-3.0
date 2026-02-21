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
        self.service = TelegramIntakeService(FakeTelegramClient())

    def test_link_to_existing_deal_and_deduplicate(self):
        result = self.service.process_message(
            user=self.user,
            update_id=1,
            chat_id=1001,
            message={
                "message_id": 200,
                "text": "Клиент: Иван Иванов\nТелефон: +7 (999) 111-22-33",
                "chat": {"id": 1001, "type": "private"},
            },
        )
        self.assertIn("Найдены подходящие сделки", result.text)

        pick_result = self.service.process_pick(user=self.user, pick_index=1)
        self.assertIn("привязано к сделке", pick_result.text)
        self.assertEqual(Note.objects.filter(deal=self.deal).count(), 1)

        duplicate_result = self.service.process_message(
            user=self.user,
            update_id=2,
            chat_id=1001,
            message={
                "message_id": 200,
                "text": "Клиент: Иван Иванов\nТелефон: +7 (999) 111-22-33",
                "chat": {"id": 1001, "type": "private"},
            },
        )
        self.assertIn("уже обработано", duplicate_result.text)
        self.assertEqual(Note.objects.filter(deal=self.deal).count(), 1)

        inbound = TelegramInboundMessage.objects.get(chat_id=1001, message_id=200)
        self.assertEqual(inbound.status, TelegramInboundMessage.Status.LINKED_EXISTING)
        self.assertEqual(inbound.linked_deal_id, self.deal.id)

    def test_create_new_deal_when_candidates_missing(self):
        result = self.service.process_message(
            user=self.user,
            update_id=10,
            chat_id=1001,
            message={
                "message_id": 210,
                "text": "Клиент: Петров Петр\nТелефон: +79992223344",
                "chat": {"id": 1001, "type": "private"},
            },
        )
        self.assertIn("не найдено", result.text)

        create_result = self.service.process_create(user=self.user)
        self.assertIn("Создана новая сделка", create_result.text)

        inbound = TelegramInboundMessage.objects.get(chat_id=1001, message_id=210)
        self.assertEqual(inbound.status, TelegramInboundMessage.Status.CREATED_NEW_DEAL)
        self.assertIsNotNone(inbound.linked_deal_id)
        created_deal = Deal.objects.get(id=inbound.linked_deal_id)
        self.assertEqual(created_deal.source, "telegram")
        self.assertEqual(created_deal.seller_id, self.user.id)
        self.assertEqual(Note.objects.filter(deal=created_deal).count(), 1)

    def test_pick_expires_after_timeout(self):
        self.service.process_message(
            user=self.user,
            update_id=20,
            chat_id=1001,
            message={
                "message_id": 220,
                "text": "Клиент: Иван Иванов\nТелефон: +7 (999) 111-22-33",
                "chat": {"id": 1001, "type": "private"},
            },
        )
        session = TelegramDealRoutingSession.objects.get(
            inbound_message__message_id=220
        )
        session.expires_at = timezone.now() - timedelta(minutes=1)
        session.save(update_fields=["expires_at"])

        result = self.service.process_pick(user=self.user, pick_index=1)
        self.assertIn("истекла", result.text)

        session.refresh_from_db()
        self.assertEqual(session.state, TelegramDealRoutingSession.State.EXPIRED)
        inbound = session.inbound_message
        inbound.refresh_from_db()
        self.assertEqual(inbound.status, TelegramInboundMessage.Status.EXPIRED)

    def test_candidate_search_is_limited_to_user_access(self):
        inaccessible_deal = Deal.objects.create(
            title="Чужая сделка",
            client=self.client_obj,
            seller=self.other_user,
            status=Deal.DealStatus.OPEN,
        )

        self.service.process_message(
            user=self.user,
            update_id=30,
            chat_id=1001,
            message={
                "message_id": 230,
                "text": "Клиент: Иван Иванов\nТелефон: +7 (999) 111-22-33",
                "chat": {"id": 1001, "type": "private"},
            },
        )
        session = TelegramDealRoutingSession.objects.get(
            inbound_message__message_id=230
        )
        self.assertIn(str(self.deal.id), session.candidate_deal_ids)
        self.assertNotIn(str(inaccessible_deal.id), session.candidate_deal_ids)

    def test_partial_file_failures_do_not_break_message_linking(self):
        media_root = tempfile.mkdtemp(prefix="tg-intake-test-")
        try:
            self.service = TelegramIntakeService(
                FakeTelegramClient(file_payloads={"doc_ok": b"pdf", "photo_fail": None})
            )
            with override_settings(MEDIA_ROOT=media_root):
                self.service.process_message(
                    user=self.user,
                    update_id=40,
                    chat_id=1001,
                    message={
                        "message_id": 240,
                        "text": "Телефон: +7 (999) 111-22-33",
                        "chat": {"id": 1001, "type": "private"},
                        "document": {
                            "file_id": "doc_ok",
                            "file_name": "offer.pdf",
                            "mime_type": "application/pdf",
                        },
                        "photo": [{"file_id": "photo_fail"}],
                    },
                )
                result = self.service.process_pick(user=self.user, pick_index=1)
                self.assertIn("Ошибки файлов: 1", result.text)
                self.assertEqual(Document.objects.filter(deal=self.deal).count(), 1)
                self.assertEqual(Note.objects.filter(deal=self.deal).count(), 1)
        finally:
            shutil.rmtree(media_root, ignore_errors=True)
