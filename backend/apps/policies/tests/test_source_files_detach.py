from unittest.mock import patch

from apps.clients.models import Client
from apps.common.tests.auth_utils import AuthenticatedAPITestCase
from apps.deals.models import Deal, InsuranceCompany, InsuranceType
from apps.notes.models import Note
from django.contrib.auth.models import User
from rest_framework import status


class PolicySourceFilesDetachTests(AuthenticatedAPITestCase):
    def setUp(self):
        super().setUp()
        self.seller = User.objects.create_user(
            username="seller_detach", password="pass"
        )
        self.client_obj = Client.objects.create(name="Detach Client")
        self.deal = Deal.objects.create(
            title="Detach Deal",
            client=self.client_obj,
            seller=self.seller,
            status="open",
            stage_name="initial",
        )
        self.insurance_company = InsuranceCompany.objects.create(name="Detach Company")
        self.insurance_type = InsuranceType.objects.create(name="Detach Type")
        self.authenticate(self.seller)

    def test_source_files_are_detached_from_deal_notes_after_policy_create(self):
        source_id = "drive-file-policy"
        second_source_id = "drive-file-policy-2"
        keep_id = "drive-file-keep"

        first_note = Note.objects.create(
            deal=self.deal,
            body="Письмо с полисом",
            attachments=[
                {"id": source_id, "name": "policy.pdf", "mime_type": "application/pdf"},
                {"id": keep_id, "name": "other.pdf", "mime_type": "application/pdf"},
            ],
        )
        second_note = Note.objects.create(
            deal=self.deal,
            body="Ещё одно письмо",
            attachments=[
                {
                    "id": second_source_id,
                    "name": "policy-2.pdf",
                    "mime_type": "application/pdf",
                },
            ],
        )

        payload = {
            "number": "POLICY-DETACH-001",
            "deal": str(self.deal.id),
            "insurance_company": str(self.insurance_company.id),
            "insurance_type": str(self.insurance_type.id),
            "source_file_ids": [source_id, second_source_id],
        }

        with patch(
            "apps.policies.views.PolicyViewSet._move_recognized_file_to_folder"
        ) as mocked_move:
            response = self.api_client.post("/api/v1/policies/", payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(mocked_move.call_count, 2)

        first_note.refresh_from_db()
        second_note.refresh_from_db()

        self.assertEqual(len(first_note.attachments), 1)
        self.assertEqual(first_note.attachments[0]["id"], keep_id)
        self.assertEqual(second_note.attachments, [])

    def test_single_source_file_id_is_detached_from_note(self):
        source_id = "drive-file-single"
        keep_id = "drive-file-still-here"
        note = Note.objects.create(
            deal=self.deal,
            body="Один файл полиса",
            attachments=[
                {"id": source_id, "name": "single.pdf", "mime_type": "application/pdf"},
                {"id": keep_id, "name": "keep.pdf", "mime_type": "application/pdf"},
            ],
        )

        payload = {
            "number": "POLICY-DETACH-SINGLE-001",
            "deal": str(self.deal.id),
            "insurance_company": str(self.insurance_company.id),
            "insurance_type": str(self.insurance_type.id),
            "source_file_id": source_id,
        }

        with patch(
            "apps.policies.views.PolicyViewSet._move_recognized_file_to_folder"
        ) as mocked_move:
            response = self.api_client.post("/api/v1/policies/", payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(mocked_move.call_count, 1)
        self.assertEqual(mocked_move.call_args[0][1], source_id)

        note.refresh_from_db()
        self.assertEqual(len(note.attachments), 1)
        self.assertEqual(note.attachments[0]["id"], keep_id)

    def test_duplicate_source_file_ids_are_deduplicated_for_move_and_detach(self):
        source_id = "drive-file-dup"
        note = Note.objects.create(
            deal=self.deal,
            body="Дубликаты",
            attachments=[
                {"id": source_id, "name": "dup-a.pdf", "mime_type": "application/pdf"},
                {"id": source_id, "name": "dup-b.pdf", "mime_type": "application/pdf"},
            ],
        )

        payload = {
            "number": "POLICY-DETACH-DUP-001",
            "deal": str(self.deal.id),
            "insurance_company": str(self.insurance_company.id),
            "insurance_type": str(self.insurance_type.id),
            "source_file_ids": [source_id, source_id, source_id],
        }

        with patch(
            "apps.policies.views.PolicyViewSet._move_recognized_file_to_folder"
        ) as mocked_move:
            response = self.api_client.post("/api/v1/policies/", payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(mocked_move.call_count, 1)

        note.refresh_from_db()
        self.assertEqual(note.attachments, [])

    def test_without_source_files_note_attachments_remain_unchanged(self):
        source_id = "drive-file-untouched"
        note = Note.objects.create(
            deal=self.deal,
            body="Без source ids",
            attachments=[
                {
                    "id": source_id,
                    "name": "untouched.pdf",
                    "mime_type": "application/pdf",
                },
            ],
        )

        payload = {
            "number": "POLICY-NO-SOURCE-001",
            "deal": str(self.deal.id),
            "insurance_company": str(self.insurance_company.id),
            "insurance_type": str(self.insurance_type.id),
        }

        with patch(
            "apps.policies.views.PolicyViewSet._move_recognized_file_to_folder"
        ) as mocked_move:
            response = self.api_client.post("/api/v1/policies/", payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(mocked_move.call_count, 0)

        note.refresh_from_db()
        self.assertEqual(len(note.attachments), 1)
        self.assertEqual(note.attachments[0]["id"], source_id)
