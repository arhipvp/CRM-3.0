from __future__ import annotations

from unittest.mock import patch

from apps.policies.ai_service import PolicyRecognitionError
from apps.clients.models import Client
from apps.common.tests.auth_utils import AuthenticatedAPITestCase
from apps.deals.models import Deal
from django.contrib.auth.models import User
from rest_framework import status


class PolicyRecognizeNestedDriveFilesTests(AuthenticatedAPITestCase):
    def setUp(self):
        super().setUp()
        self.seller = User.objects.create_user(  # pragma: allowlist secret
            username="seller-policy-recognition",
            password="pass",  # pragma: allowlist secret
        )
        self.client_record = Client.objects.create(name="Client")
        self.deal = Deal.objects.create(
            title="Policy Recognition Deal",
            client=self.client_record,
            seller=self.seller,
            status="open",
            stage_name="initial",
        )
        Deal.objects.filter(pk=self.deal.pk).update(drive_folder_id="deal-folder")
        self.token_for(self.seller)
        self.authenticate(self.seller)

    def test_recognize_uses_nested_drive_file(self):
        file_map = {
            "nested-file": {
                "id": "nested-file",
                "name": "policy.pdf",
                "mime_type": "application/pdf",
                "is_folder": False,
                "parent_id": "subfolder-1",
            }
        }

        with (
            patch(
                "apps.policies.views.build_drive_file_tree_map",
                return_value=file_map,
            ) as tree_mock,
            patch(
                "apps.policies.views.download_drive_file",
                return_value=b"policy-bytes",
            ),
            patch(
                "apps.policies.views.extract_text_from_bytes",
                return_value="policy text",
            ) as extract_mock,
            patch(
                "apps.policies.views.recognize_policy_from_text",
                return_value=({"policyNumber": "123"}, "transcript"),
            ) as recognize_mock,
        ):
            response = self.api_client.post(
                "/api/v1/policies/recognize/",
                {"deal_id": str(self.deal.id), "file_ids": ["nested-file"]},
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["results"][0]["status"], "parsed")
        self.assertEqual(response.data["results"][0]["data"]["policyNumber"], "123")
        tree_mock.assert_called_once_with("deal-folder")
        extract_mock.assert_called_once_with(b"policy-bytes", "policy.pdf")
        recognize_mock.assert_called_once()

    def test_recognize_docx_uses_same_text_pipeline(self):
        file_map = {
            "docx-file": {
                "id": "docx-file",
                "name": "policy.docx",
                "mime_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "is_folder": False,
                "parent_id": None,
            }
        }

        with (
            patch(
                "apps.policies.views.build_drive_file_tree_map",
                return_value=file_map,
            ),
            patch(
                "apps.policies.views.download_drive_file",
                return_value=b"docx-bytes",
            ),
            patch(
                "apps.policies.views.extract_text_from_bytes",
                return_value="docx policy text",
            ) as extract_mock,
            patch(
                "apps.policies.views.recognize_policy_from_text",
                return_value=({"policyNumber": "DOCX-123"}, "transcript"),
            ) as recognize_mock,
        ):
            response = self.api_client.post(
                "/api/v1/policies/recognize/",
                {"deal_id": str(self.deal.id), "file_ids": ["docx-file"]},
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["results"][0]["status"], "parsed")
        self.assertEqual(
            response.data["results"][0]["data"]["policyNumber"], "DOCX-123"
        )
        extract_mock.assert_called_once_with(b"docx-bytes", "policy.docx")
        recognize_mock.assert_called_once_with(
            "Файл policy.docx:\ndocx policy text",
            extra_companies=[],
            extra_types=[],
        )

    def test_recognize_keeps_processing_when_doc_extraction_fails(self):
        file_map = {
            "bad-doc": {
                "id": "bad-doc",
                "name": "broken.doc",
                "mime_type": "application/msword",
                "is_folder": False,
                "parent_id": None,
            },
            "good-pdf": {
                "id": "good-pdf",
                "name": "policy.pdf",
                "mime_type": "application/pdf",
                "is_folder": False,
                "parent_id": None,
            },
        }

        with (
            patch(
                "apps.policies.views.build_drive_file_tree_map",
                return_value=file_map,
            ),
            patch(
                "apps.policies.views.download_drive_file",
                side_effect=[b"doc-bytes", b"pdf-bytes"],
            ),
            patch(
                "apps.policies.views.extract_text_from_bytes",
                side_effect=[
                    PolicyRecognitionError(
                        "Не удалось извлечь текст из Word-файла broken.doc."
                    ),
                    "pdf policy text",
                ],
            ) as extract_mock,
            patch(
                "apps.policies.views.recognize_policy_from_text",
                return_value=({"policyNumber": "PDF-123"}, "transcript"),
            ) as recognize_mock,
        ):
            response = self.api_client.post(
                "/api/v1/policies/recognize/",
                {"deal_id": str(self.deal.id), "file_ids": ["bad-doc", "good-pdf"]},
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 2)
        error_result = next(
            item for item in response.data["results"] if item["fileId"] == "bad-doc"
        )
        parsed_result = next(
            item for item in response.data["results"] if item["fileId"] == "good-pdf"
        )
        self.assertEqual(error_result["status"], "error")
        self.assertIn("Word-файла", error_result["message"])
        self.assertEqual(parsed_result["status"], "parsed")
        self.assertEqual(parsed_result["data"]["policyNumber"], "PDF-123")
        self.assertEqual(extract_mock.call_count, 2)
        recognize_mock.assert_called_once()
