from __future__ import annotations

from unittest.mock import patch

from apps.clients.models import Client
from apps.common.tests.auth_utils import AuthenticatedAPITestCase
from apps.deals.models import Deal
from apps.notes.models import Note
from django.contrib.auth.models import User
from rest_framework import status


class DealDocumentRecognitionTests(AuthenticatedAPITestCase):
    def setUp(self):
        super().setUp()
        self.seller = User.objects.create_user(username="seller-doc", password="pass")
        self.other_user = User.objects.create_user(
            username="other-doc", password="pass"
        )
        self.client_record = Client.objects.create(name="Client")
        self.deal = Deal.objects.create(
            title="Recognition deal",
            client=self.client_record,
            seller=self.seller,
            status="open",
            stage_name="initial",
        )
        self.token_for(self.seller)
        self.token_for(self.other_user)

    def test_recognize_documents_success_creates_note(self):
        self.authenticate(self.seller)
        Deal.objects.filter(pk=self.deal.pk).update(drive_folder_id="deal-folder")
        drive_files = [
            {"id": "file-1", "name": "passport.jpg", "is_folder": False},
        ]

        with (
            patch(
                "apps.deals.view_mixins.document_recognition.list_drive_folder_contents",
                return_value=drive_files,
            ),
            patch(
                "apps.deals.view_mixins.document_recognition.download_drive_file",
                return_value=b"image-bytes",
            ),
            patch(
                "apps.deals.view_mixins.document_recognition.recognize_document_from_file"
            ) as recognize_mock,
        ):
            recognize_mock.return_value.document_type = "passport"
            recognize_mock.return_value.confidence = 0.93
            recognize_mock.return_value.warnings = []
            recognize_mock.return_value.data = {"series": "1234", "number": "567890"}
            recognize_mock.return_value.transcript = '{"document_type":"passport"}'

            response = self.api_client.post(
                f"/api/v1/deals/{self.deal.id}/recognize-documents/",
                {"file_ids": ["file-1"]},
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 1)
        item = response.data["results"][0]
        self.assertEqual(item["status"], "parsed")
        self.assertEqual(item["documentType"], "passport")
        self.assertEqual(item["confidence"], 0.93)
        self.assertTrue(response.data.get("noteId"))
        note = Note.objects.get(pk=response.data["noteId"])
        self.assertIn("Распознавание документов (ИИ)", note.body)
        self.assertIn("passport.jpg", note.body)

    def test_recognize_documents_returns_partial_errors(self):
        self.authenticate(self.seller)
        Deal.objects.filter(pk=self.deal.pk).update(drive_folder_id="deal-folder")
        drive_files = [
            {"id": "file-1", "name": "passport.jpg", "is_folder": False},
            {"id": "file-2", "name": "bad.jpg", "is_folder": False},
        ]

        with (
            patch(
                "apps.deals.view_mixins.document_recognition.list_drive_folder_contents",
                return_value=drive_files,
            ),
            patch(
                "apps.deals.view_mixins.document_recognition.download_drive_file",
                side_effect=[b"ok", b"bad"],
            ),
            patch(
                "apps.deals.view_mixins.document_recognition.recognize_document_from_file"
            ) as recognize_mock,
        ):
            recognize_mock.side_effect = [
                type(
                    "Payload",
                    (),
                    {
                        "document_type": "passport",
                        "confidence": 0.9,
                        "warnings": [],
                        "data": {"number": "123"},
                        "transcript": "ok",
                    },
                )(),
                Exception("boom"),
            ]

            response = self.api_client.post(
                f"/api/v1/deals/{self.deal.id}/recognize-documents/",
                {"file_ids": ["file-1", "file-2"]},
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 2)
        statuses = [item["status"] for item in response.data["results"]]
        self.assertIn("parsed", statuses)
        self.assertIn("error", statuses)

    def test_recognize_documents_marks_missing_file_as_error(self):
        self.authenticate(self.seller)
        Deal.objects.filter(pk=self.deal.pk).update(drive_folder_id="deal-folder")
        with patch(
            "apps.deals.view_mixins.document_recognition.list_drive_folder_contents",
            return_value=[],
        ):
            response = self.api_client.post(
                f"/api/v1/deals/{self.deal.id}/recognize-documents/",
                {"file_ids": ["missing-file"]},
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["results"][0]["status"], "error")
        self.assertIn("не найден", response.data["results"][0]["message"].lower())

    def test_other_user_cannot_access_recognition(self):
        self.authenticate(self.other_user)
        response = self.api_client.post(
            f"/api/v1/deals/{self.deal.id}/recognize-documents/",
            {"file_ids": ["file-1"]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
