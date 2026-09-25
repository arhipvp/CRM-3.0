import tempfile
from decimal import Decimal
from email.message import EmailMessage
from unittest.mock import patch

from apps.chat.models import ChatMessage
from apps.clients.models import Client
from apps.common.drive import DriveError
from apps.deals.models import (
    Bank,
    Deal,
    DealEvent,
    InsuranceCompany,
    InsuranceType,
    Quote,
)
from apps.documents.models import Document
from apps.finances.models import FinancialRecord, Payment
from apps.mailboxes.models import Mailbox
from apps.notes.models import Note
from apps.policies.models import Policy
from apps.tasks.models import Task
from apps.users.models import AuditLog
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework.test import APITestCase

from .models import CodexReadKey, CodexWriteKey
from .write_test_cases import CodexWriteApiTests as CodexWriteApiTests


class CodexReadApiTests(APITestCase):
    def setUp(self):
        for target in (
            "apps.clients.signals.ensure_client_folder",
            "apps.deals.signals.ensure_deal_folder",
            "apps.policies.signals.ensure_policy_folder",
        ):
            mocked = patch(target, return_value=None)
            mocked.start()
            self.addCleanup(mocked.stop)
        self.key, self.token = CodexReadKey.issue("test")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token}")
        self.customer = Client.objects.create(name="Бумблис", phone="79000000000")
        self.deal = Deal.objects.create(title="КАСКО Jaguar", client=self.customer)
        self.other_deal = Deal.objects.create(
            title="Чужая сделка", client=self.customer
        )
        self.base = f"/api/v1/codex/deals/{self.deal.id}/"

    def test_search_and_closed_deal_but_not_deleted(self):
        self.deal.status = Deal.DealStatus.WON
        self.deal.save()
        response = self.client.get("/api/v1/codex/deals/?q=Бумблис")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 2)
        self.assertIn(
            str(self.deal.id), [item["id"] for item in response.data["results"]]
        )
        self.other_deal.delete()
        response = self.client.get("/api/v1/codex/deals/?q=Бумблис")
        self.assertEqual(response.data["count"], 1)

    def test_key_is_required_revocable_and_cannot_write(self):
        self.client.credentials()
        missing_response = self.client.get(self.base)
        self.assertEqual(missing_response.status_code, 403)
        self.client.credentials(HTTP_AUTHORIZATION="Bearer invalid")
        self.assertEqual(self.client.get(self.base).status_code, 403)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token}")
        self.assertNotIn(self.token, str(missing_response.data))
        self.assertNotEqual(self.key.token_hash, self.token)
        self.assertEqual(self.client.post(self.base, {}).status_code, 405)
        self.assertEqual(self.client.get(self.base).status_code, 200)
        self.key.revoke()
        self.assertEqual(self.client.get(self.base).status_code, 403)

    def test_sections_and_financial_records(self):
        Policy.objects.create(number="TEST-1", deal=self.deal, client=self.customer)
        company = InsuranceCompany.objects.create(name="РЕСО")
        insurance_type = InsuranceType.objects.create(name="КАСКО")
        Quote.objects.create(
            deal=self.deal,
            insurance_company=company,
            insurance_type=insurance_type,
            sum_insured=Decimal("1000000"),
            premium=Decimal("12000"),
        )
        Note.objects.create(deal=self.deal, body="Полис приложен")
        Task.objects.create(deal=self.deal, title="Продлить")
        DealEvent.objects.create(deal=self.deal, event_type="manual", title="Звонок")
        AuditLog.objects.create(
            object_type="deal", object_id=str(self.deal.id), action="update"
        )
        payment = Payment.objects.create(deal=self.deal, amount=Decimal("12000"))
        FinancialRecord.objects.create(payment=payment, amount=Decimal("1200"))
        ChatMessage.objects.create(deal=self.deal, body="Здравствуйте")
        self.assertEqual(
            self.client.get(self.base + "sections/client/").data["name"], "Бумблис"
        )
        for section in (
            "policies",
            "quotes",
            "notes",
            "tasks",
            "history",
            "finances",
            "chat",
        ):
            response = self.client.get(self.base + f"sections/{section}/")
            self.assertEqual(response.status_code, 200, section)
            self.assertEqual(response.data["count"], 1, section)
        audit = self.client.get(self.base + "sections/history/?kind=audit")
        self.assertGreaterEqual(audit.data["count"], 1)
        records = self.client.get(self.base + "sections/finances/?kind=records")
        self.assertEqual(records.data["count"], 1)
        self.assertEqual(records.data["results"][0]["amount"], "1200.00")

    @patch("apps.codex_reader.views.build_drive_file_tree_map")
    def test_file_catalog_nested_drive_and_cross_deal_denial(self, tree):
        self.deal.drive_folder_id = "deal-folder"
        self.deal.save()
        tree.return_value = {
            "file-a": {
                "id": "file-a",
                "name": "policy.pdf",
                "mime_type": "application/pdf",
                "size": 12,
                "is_folder": False,
            }
        }
        Note.objects.create(
            deal=self.deal,
            attachments=[{"id": "file-a", "name": "policy.pdf"}, {"id": "outside"}],
        )
        with tempfile.TemporaryDirectory() as directory, override_settings(
            MEDIA_ROOT=directory
        ):
            document = Document.objects.create(
                deal=self.other_deal,
                title="private.txt",
                file=SimpleUploadedFile("private.txt", b"secret"),
            )
            response = self.client.get(self.base + "files/")
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data["count"], 1)
            self.assertEqual(response.data["results"][0]["name"], "policy.pdf")
            self.assertEqual(len(response.data["results"][0]["note_ids"]), 1)
            wrong = self.client.get(self.base + f"files/l_{document.id}/download/")
            self.assertEqual(wrong.status_code, 404)
            outside = self.client.get(self.base + "files/d_b3V0c2lkZQ/download/")
            self.assertEqual(outside.status_code, 404)

    def test_local_file_download(self):
        with tempfile.TemporaryDirectory() as directory, override_settings(
            MEDIA_ROOT=directory
        ):
            document = Document.objects.create(
                deal=self.deal,
                title="policy.txt",
                file=SimpleUploadedFile("policy.txt", b"sample policy"),
            )
            response = self.client.get(self.base + f"files/l_{document.id}/download/")
            self.assertEqual(response.status_code, 200)
            self.assertEqual(b"".join(response.streaming_content), b"sample policy")

    @patch("apps.codex_reader.views.download_drive_file", return_value=b"PDF content")
    @patch("apps.codex_reader.views.build_drive_file_tree_map")
    def test_drive_download_and_size_limit(self, tree, download):
        self.deal.drive_folder_id = "deal-folder"
        self.deal.save()
        tree.return_value = {
            "file-a": {
                "id": "file-a",
                "name": "policy.pdf",
                "mime_type": "application/pdf",
                "size": 11,
                "is_folder": False,
            }
        }
        file_id = "d_ZmlsZS1h"
        response = self.client.get(self.base + f"files/{file_id}/download/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, b"PDF content")
        download.assert_called_once_with("file-a")
        tree.return_value["file-a"]["size"] = 26 * 1024 * 1024
        response = self.client.get(self.base + f"files/{file_id}/download/")
        self.assertEqual(response.status_code, 413)
        download.assert_called_once()

    @override_settings(
        MAILCOW_IMAP_HOST="imap.example.test",
        MAILCOW_IMAP_PORT=993,
        MAILCOW_IMAP_MASTER_USER="master",
        MAILCOW_IMAP_MASTER_PASS="placeholder",
    )
    @patch("apps.mailboxes.services._imap_login")
    @patch("apps.codex_reader.views.imaplib.IMAP4_SSL")
    def test_mailbox_message_body_on_demand(self, imap_class, unused_login):
        user = get_user_model().objects.create_user(username="mail-owner")
        Mailbox.objects.create(
            user=user,
            deal=self.deal,
            email="deal@example.test",
            local_part="deal",
            domain="example.test",
        )
        message = EmailMessage()
        message["Subject"] = "Расчёт"
        message["From"] = "client@example.test"
        message.set_content("Текст письма")
        imap = imap_class.return_value.__enter__.return_value
        imap.uid.return_value = ("OK", [(b"1 (RFC822)", message.as_bytes())])
        response = self.client.get(self.base + "mailbox/messages/1/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("Текст письма", response.data["body"])
        imap.select.assert_called_once_with("INBOX", readonly=True)
        imap.uid.assert_called_once_with("fetch", b"1", "(RFC822)")

    @override_settings(
        MAILCOW_IMAP_HOST="imap.example.test",
        MAILCOW_IMAP_PORT=993,
        MAILCOW_IMAP_MASTER_USER="master",
        MAILCOW_IMAP_MASTER_PASS="placeholder",
    )
    @patch("apps.mailboxes.services._imap_login")
    @patch("apps.codex_reader.views.imaplib.IMAP4_SSL")
    def test_mailbox_list_reads_headers_only(self, imap_class, unused_login):
        user = get_user_model().objects.create_user(username="mail-owner")
        Mailbox.objects.create(
            user=user,
            deal=self.deal,
            email="deal@example.test",
            local_part="deal",
            domain="example.test",
        )
        message = EmailMessage()
        message["Subject"] = "Расчёт"
        message["From"] = "client@example.test"
        message.set_content("Секретный текст")
        imap = imap_class.return_value.__enter__.return_value
        imap.select.return_value = ("OK", [])
        imap.uid.side_effect = [
            ("OK", [b"1"]),
            ("OK", [(b"1 (BODY[HEADER])", message.as_bytes())]),
        ]
        response = self.client.get(self.base + "sections/mailbox/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["messages"]["results"][0]["id"], "1")
        self.assertNotIn("Секретный текст", str(response.data))
        self.assertEqual(imap.uid.call_args_list[1].args[2], "(BODY.PEEK[HEADER])")

    def test_pagination_limit(self):
        Deal.objects.bulk_create(
            [
                Deal(title=f"Бумблис {index}", client=self.customer)
                for index in range(101)
            ]
        )
        response = self.client.get("/api/v1/codex/deals/?q=Бумблис&page_size=1000")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["results"]), 100)
        self.assertIn("page_size=100", response.data["next"])

    def test_passport_contains_all_records_and_only_deal_files(self):
        company = InsuranceCompany.objects.create(name="РЕСО")
        kind = InsuranceType.objects.create(name="Ипотека / жизнь")
        bank = Bank.objects.create(name="Сбербанк")
        for number in ("P-1", "P-2"):
            Policy.objects.create(
                number=number,
                deal=self.deal,
                client=self.customer,
                insurance_company=company,
                insurance_type=kind,
                mortgage_bank=bank,
            )
        for premium in ("100.00", "200.00"):
            Quote.objects.create(
                deal=self.deal,
                insurance_company=company,
                insurance_type=kind,
                premium=Decimal(premium),
            )
        Note.objects.create(deal=self.deal, body="Первая")
        Note.objects.create(deal=self.deal, body="Вторая")
        Policy.objects.create(number="FOREIGN", deal=self.other_deal)
        Quote.objects.create(
            deal=self.other_deal,
            insurance_company=company,
            insurance_type=kind,
            premium=Decimal("999.00"),
        )
        Note.objects.create(deal=self.other_deal, body="Чужая заметка")
        with tempfile.TemporaryDirectory() as directory, override_settings(
            MEDIA_ROOT=directory
        ):
            own_document = Document.objects.create(
                deal=self.deal,
                title="own.pdf",
                file=SimpleUploadedFile("own.pdf", b"own"),
            )
            foreign_document = Document.objects.create(
                deal=self.other_deal,
                title="foreign.pdf",
                file=SimpleUploadedFile("foreign.pdf", b"foreign"),
            )
            response = self.client.get(self.base + "passport/")
        self.assertEqual(response.status_code, 200)
        data = response.data
        self.assertEqual(data["schema_version"], 1)
        self.assertTrue(data["generated_at"])
        self.assertEqual(data["deal"]["id"], str(self.deal.id))
        self.assertEqual(data["client"]["id"], str(self.customer.id))
        self.assertEqual(len(data["policies"]), 2)
        self.assertEqual(len(data["quotes"]), 2)
        self.assertEqual(len(data["notes"]), 2)
        self.assertEqual(data["policies"][0]["mortgage_bank_name"], "Сбербанк")
        self.assertEqual(data["quotes"][0]["insurance_company_name"], "РЕСО")
        self.assertEqual(data["files"]["status"], "ok")
        self.assertEqual(
            [item["id"] for item in data["files"]["items"]], [f"l_{own_document.id}"]
        )
        self.assertIn("/download/", data["files"]["items"][0]["download_url"])
        self.assertNotIn(str(foreign_document.id), str(data))
        self.assertNotIn("Чужая заметка", str(data))

    def test_passport_closed_deleted_and_key_scope(self):
        self.deal.status = Deal.DealStatus.WON
        self.deal.save(update_fields=["status"])
        url = self.base + "passport/"
        self.assertEqual(self.client.get(url).status_code, 200)
        self.assertEqual(self.client.post(url, {}).status_code, 405)
        self.client.credentials(HTTP_AUTHORIZATION="Bearer invalid")
        self.assertEqual(self.client.get(url).status_code, 403)
        _, write_token = CodexWriteKey.issue("write-test")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {write_token}")
        self.assertEqual(self.client.get(url).status_code, 403)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token}")
        self.key.revoke()
        self.assertEqual(self.client.get(url).status_code, 403)
        self.key, self.token = CodexReadKey.issue("new-test")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token}")
        self.deal.delete()
        self.assertEqual(self.client.get(url).status_code, 404)

    @patch(
        "apps.codex_reader.views.build_drive_file_tree_map",
        side_effect=DriveError("unavailable"),
    )
    def test_passport_drive_failure_returns_data_and_warning(self, unused_tree):
        self.deal.drive_folder_id = "deal-folder"
        self.deal.save(update_fields=["drive_folder_id"])
        Note.objects.create(deal=self.deal, body="Retained")
        response = self.client.get(self.base + "passport/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["files"], {"status": "unavailable", "items": []})
        self.assertTrue(response.data["warnings"])
        self.assertEqual(response.data["notes"][0]["body"], "Retained")

    @patch("apps.codex_reader.views.MAX_PASSPORT_BYTES", 100)
    def test_passport_size_limit_is_explicit(self):
        response = self.client.get(self.base + "passport/")
        self.assertEqual(response.status_code, 413)
        self.assertEqual(response.data["code"], "passport_too_large")

    def test_passport_does_not_truncate_fields_below_aggregate_limit(self):
        body = "Д" * 21000
        Note.objects.create(deal=self.deal, body=body)
        response = self.client.get(self.base + "passport/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["notes"][0]["body"], body)
        self.assertNotIn("_truncated_fields", response.data["notes"][0])

    @patch("apps.codex_reader.views._catalog", side_effect=ValueError("too many"))
    def test_passport_excess_file_catalog_is_explicit(self, unused_catalog):
        response = self.client.get(self.base + "passport/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["files"], {"status": "too_large", "items": []})
        self.assertTrue(response.data["warnings"])
