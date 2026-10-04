from __future__ import annotations

from unittest.mock import ANY, patch

from apps.clients.models import Client
from apps.common.tests.auth_utils import AuthenticatedAPITestCase
from apps.deals.models import Deal
from apps.policies.ai_service import PolicyRecognitionError
from django.contrib.auth.models import User
from django.test import override_settings
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
                "apps.policies.services.recognition.build_drive_file_tree_map",
                return_value=file_map,
            ) as tree_mock,
            patch(
                "apps.policies.services.recognition.download_drive_file",
                return_value=b"policy-bytes",
            ),
            patch(
                "apps.policies.services.recognition.extract_text_from_bytes",
                return_value="policy text",
            ) as extract_mock,
            patch(
                "apps.policies.services.recognition.recognize_policy_from_text",
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
        self.assertNotIn("transcript", response.data["results"][0])
        tree_mock.assert_called_once_with("deal-folder")
        extract_mock.assert_called_once_with(b"policy-bytes", "policy.pdf")
        recognize_mock.assert_called_once()

    def test_pdf_text_extraction_failure_uses_batch_vision_without_text_request(self):
        file_map = {
            "broken-pdf": {
                "id": "broken-pdf",
                "name": "policy.pdf",
                "mime_type": "application/pdf",
                "is_folder": False,
                "parent_id": None,
            }
        }
        expected = {"policyNumber": "VISION-123"}

        with (
            patch(
                "apps.policies.services.recognition.build_drive_file_tree_map",
                return_value=file_map,
            ),
            patch(
                "apps.policies.services.recognition.download_drive_file",
                return_value=b"%PDF-broken",
            ),
            patch(
                "apps.policies.services.recognition.extract_text_from_bytes",
                side_effect=PolicyRecognitionError("PDF extraction failed"),
            ),
            patch(
                "apps.policies.services.recognition.recognize_policy_from_text"
            ) as text_mock,
            patch(
                "apps.policies.services.recognition.recognize_policy_from_pdf_images",
                return_value=(expected, "vision transcript"),
            ) as vision_mock,
        ):
            response = self.api_client.post(
                "/api/v1/policies/recognize/",
                {"deal_id": str(self.deal.id), "file_ids": ["broken-pdf"]},
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["results"][0]["data"], expected)
        text_mock.assert_not_called()
        vision_mock.assert_called_once()

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
                "apps.policies.services.recognition.build_drive_file_tree_map",
                return_value=file_map,
            ),
            patch(
                "apps.policies.services.recognition.download_drive_file",
                return_value=b"docx-bytes",
            ),
            patch(
                "apps.policies.services.recognition.extract_text_from_bytes",
                return_value="docx policy text",
            ) as extract_mock,
            patch(
                "apps.policies.services.recognition.recognize_policy_from_text",
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
            extra_banks=ANY,
        )

    def test_recognize_jpg_uses_vision_without_text_extraction(self):
        file_map = {
            "image-file": {
                "id": "image-file",
                "name": "policy.jpg",
                "mime_type": "image/jpeg",
                "is_folder": False,
                "parent_id": None,
            }
        }
        expected = {"policyNumber": "JPG-123"}

        with (
            patch(
                "apps.policies.services.recognition.build_drive_file_tree_map",
                return_value=file_map,
            ),
            patch(
                "apps.policies.services.recognition.download_drive_file",
                return_value=b"jpeg-bytes",
            ),
            patch(
                "apps.policies.services.recognition.extract_text_from_bytes"
            ) as extract_mock,
            patch(
                "apps.policies.services.recognition.recognize_policy_from_pdf_images",
                return_value=(expected, "vision transcript"),
            ) as vision_mock,
        ):
            response = self.api_client.post(
                "/api/v1/policies/recognize/",
                {"deal_id": str(self.deal.id), "file_ids": ["image-file"]},
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["results"][0]["status"], "parsed")
        self.assertEqual(response.data["results"][0]["data"], expected)
        self.assertNotIn("transcript", response.data["results"][0])
        self.assertIn("Vision", response.data["results"][0]["message"])
        extract_mock.assert_not_called()
        vision_mock.assert_called_once_with(
            [
                {
                    "id": "image-file",
                    "name": "policy.jpg",
                    "text": "",
                    "content": b"jpeg-bytes",
                }
            ],
            extra_companies=[],
            extra_types=[],
            extra_banks=ANY,
        )

    def test_text_pdf_and_jpeg_use_mixed_request(self):
        file_map = {
            file_id: {
                "id": file_id,
                "name": name,
                "mime_type": mime_type,
                "is_folder": False,
                "parent_id": None,
            }
            for file_id, name, mime_type in (
                ("pdf", "policy.pdf", "application/pdf"),
                ("image", "receipt.jpg", "image/jpeg"),
            )
        }
        text = "Полис страхования. Дата начала 01.10.2026. Премия 2637,13."
        with (
            patch(
                "apps.policies.services.recognition.build_drive_file_tree_map",
                return_value=file_map,
            ),
            patch(
                "apps.policies.services.recognition.download_drive_file",
                side_effect=[b"pdf-bytes", b"jpeg-bytes"],
            ),
            patch(
                "apps.policies.services.recognition.extract_text_from_bytes",
                return_value=text,
            ),
            patch(
                "apps.policies.services.recognition.recognize_policy_from_text"
            ) as text_mock,
            patch(
                "apps.policies.services.recognition.recognize_policy_from_pdf_images",
                return_value=({"policyNumber": "SYS-1"}, "transcript"),
            ) as mixed_mock,
        ):
            response = self.api_client.post(
                "/api/v1/policies/recognize/",
                {"deal_id": str(self.deal.id), "file_ids": ["pdf", "image"]},
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [x["status"] for x in response.data["results"]], ["parsed", "parsed"]
        )
        self.assertIn(
            "по тексту и изображениям", response.data["results"][0]["message"]
        )
        text_mock.assert_not_called()
        sent_files = mixed_mock.call_args.args[0]
        self.assertEqual(
            [file_data["name"] for file_data in sent_files],
            ["policy.pdf", "receipt.jpg"],
        )
        self.assertEqual(sent_files[0]["text"], text)
        self.assertEqual(sent_files[1]["text"], "")

    def test_tabular_text_pdf_stays_on_text_route(self):
        file_map = {
            "pdf": {
                "id": "pdf",
                "name": "policy.pdf",
                "mime_type": "application/pdf",
                "is_folder": False,
                "parent_id": None,
            }
        }
        text = (
            "Полис страхования. Марка,модель; идентификационный номер; "
            "срок действия договора."
        )
        with (
            patch(
                "apps.policies.services.recognition.build_drive_file_tree_map",
                return_value=file_map,
            ),
            patch(
                "apps.policies.services.recognition.download_drive_file",
                return_value=b"pdf-bytes",
            ),
            patch(
                "apps.policies.services.recognition.extract_text_from_bytes",
                return_value=text,
            ),
            patch(
                "apps.policies.services.recognition.recognize_policy_from_text",
                return_value=({"policyNumber": "SYS-1"}, "transcript"),
            ) as text_mock,
            patch(
                "apps.policies.services.recognition.recognize_policy_from_pdf_images"
            ) as vision_mock,
        ):
            response = self.api_client.post(
                "/api/v1/policies/recognize/",
                {"deal_id": str(self.deal.id), "file_ids": ["pdf"]},
                format="json",
            )

        self.assertEqual(response.data["results"][0]["status"], "parsed")
        text_mock.assert_called_once()
        vision_mock.assert_not_called()

    @override_settings(POLICY_RECOGNITION_MAX_VISION_PAGES=1)
    def test_visual_input_limit_is_reported_for_every_selected_file(self):
        file_map = {
            file_id: {
                "id": file_id,
                "name": f"{file_id}.jpg",
                "mime_type": "image/jpeg",
                "is_folder": False,
                "parent_id": None,
            }
            for file_id in ("first", "second")
        }
        with (
            patch(
                "apps.policies.services.recognition.build_drive_file_tree_map",
                return_value=file_map,
            ),
            patch(
                "apps.policies.services.recognition.download_drive_file",
                return_value=b"jpeg-bytes",
            ),
        ):
            response = self.api_client.post(
                "/api/v1/policies/recognize/",
                {"deal_id": str(self.deal.id), "file_ids": ["first", "second"]},
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 2)
        for result in response.data["results"]:
            self.assertEqual(result["status"], "error")
            self.assertEqual(result["error"]["code"], "vision_input_limit")
            self.assertIn("Лимит визуальных входов", result["message"])

    def test_recognize_unsupported_image_returns_clear_error(self):
        file_map = {
            "image-file": {
                "id": "image-file",
                "name": "policy.webp",
                "mime_type": "image/webp",
                "is_folder": False,
                "parent_id": None,
            }
        }

        with (
            patch(
                "apps.policies.services.recognition.build_drive_file_tree_map",
                return_value=file_map,
            ),
            patch(
                "apps.policies.services.recognition.download_drive_file",
                return_value=b"webp-bytes",
            ),
        ):
            response = self.api_client.post(
                "/api/v1/policies/recognize/",
                {"deal_id": str(self.deal.id), "file_ids": ["image-file"]},
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["results"][0]["status"], "error")
        self.assertIn(
            "Неподдерживаемый формат изображения",
            response.data["results"][0]["message"],
        )
        self.assertNotIn("transcript", response.data["results"][0])

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
                "apps.policies.services.recognition.build_drive_file_tree_map",
                return_value=file_map,
            ),
            patch(
                "apps.policies.services.recognition.download_drive_file",
                side_effect=[b"doc-bytes", b"pdf-bytes"],
            ),
            patch(
                "apps.policies.services.recognition.extract_text_from_bytes",
                side_effect=[
                    PolicyRecognitionError(
                        "Не удалось извлечь текст из Word-файла broken.doc."
                    ),
                    "pdf policy text",
                ],
            ) as extract_mock,
            patch(
                "apps.policies.services.recognition.recognize_policy_from_text",
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
