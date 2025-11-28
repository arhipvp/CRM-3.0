from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from uuid import uuid4

from apps.clients.models import Client
from apps.documents.models import Document
from apps.finances.models import FinancialRecord, Payment
from apps.notes.models import Note
from apps.policies.models import Policy
from apps.tasks.models import Task
from apps.users.models import AuditLog

from apps.deals.history_utils import (
    collect_related_ids,
    get_related_audit_logs,
    map_audit_log_entry,
)
from apps.deals.models import Deal, InsuranceCompany, InsuranceType, Quote


class DealHistoryUtilsTestCase(TestCase):
    def setUp(self):
        self.client_obj = Client.objects.create(name="History Client")
        self.target = Deal.objects.create(
            title="History Deal",
            client=self.client_obj,
            status="open",
            stage_name="initial",
        )
        self.task = Task.objects.create(title="Task", deal=self.target)
        self.note = Note.objects.create(body="Note", deal=self.target)
        self.document = Document.objects.create(
            title="Doc",
            file=SimpleUploadedFile("note.txt", b"tick"),
            deal=self.target,
        )
        self.company = InsuranceCompany.objects.create(name="SplitCo")
        self.type = InsuranceType.objects.create(name="Auto")
        self.quote = Quote.objects.create(
            deal=self.target,
            insurance_company=self.company,
            insurance_type=self.type,
            sum_insured=1000,
            premium=50,
        )
        self.policy = Policy.objects.create(
            number=f"P-{uuid4().hex}",
            deal=self.target,
            insurance_company=self.company,
            insurance_type=self.type,
            client=self.client_obj,
        )
        self.payment = Payment.objects.create(amount=100, deal=self.target)
        self.financial_record = FinancialRecord.objects.create(
            payment=self.payment,
            amount=100,
        )
        self.audit_log = AuditLog.objects.create(
            object_type="deal",
            object_id=str(self.target.id),
            action="create",
            object_name=self.target.title,
        )
        self.note_log = AuditLog.objects.create(
            object_type="note",
            object_id=str(self.note.id),
            action="create",
            object_name=str(self.note.id),
        )

    def test_collect_related_ids_returns_expected_keys(self):
        related_ids = collect_related_ids(self.target)
        self.assertIn(str(self.task.id), related_ids["task"])
        self.assertIn(str(self.note.id), related_ids["note"])
        self.assertIn(str(self.document.id), related_ids["document"])
        self.assertIn(str(self.quote.id), related_ids["quote"])
        self.assertIn(str(self.policy.id), related_ids["policy"])
        self.assertIn(str(self.payment.id), related_ids["payment"])
        self.assertIn(str(self.financial_record.id), related_ids["financial_record"])

    def test_get_related_audit_logs_includes_note_entries(self):
        related_ids = collect_related_ids(self.target)
        logs = get_related_audit_logs(self.target, related_ids=related_ids)
        note_log_ids = [log.id for log in logs if log.object_type == "note"]
        self.assertIn(self.note_log.id, note_log_ids)

    def test_map_audit_log_entry_produces_expected_payload(self):
        payload = map_audit_log_entry(self.audit_log, self.target.id)
        self.assertEqual(payload["object_type"], "deal")
        self.assertEqual(payload["object_id"], str(self.target.id))
        self.assertEqual(payload["description"], self.audit_log.description or self.audit_log.object_name)
