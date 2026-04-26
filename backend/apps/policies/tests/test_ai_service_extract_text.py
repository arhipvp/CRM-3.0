from __future__ import annotations

from io import BytesIO
from subprocess import CalledProcessError
from unittest.mock import Mock, patch

import pymupdf
from apps.policies.ai_service import (
    PolicyRecognitionError,
    _render_pdf_pages_for_vision,
    extract_text_from_bytes,
    is_extracted_policy_text_poor,
    recognize_policy_from_bytes,
)
from django.test import SimpleTestCase, override_settings
from docx import Document


class ExtractPolicyTextFromBytesTests(SimpleTestCase):
    def test_docx_text_is_extracted(self):
        document = Document()
        document.add_paragraph("Полис КАСКО")
        document.add_paragraph("Номер ABC-123")
        buffer = BytesIO()
        document.save(buffer)

        text = extract_text_from_bytes(buffer.getvalue(), "policy.docx")

        self.assertIn("Полис КАСКО", text)
        self.assertIn("Номер ABC-123", text)

    @patch("apps.policies.ai_service.shutil.which", return_value=None)
    def test_doc_without_soffice_raises_clear_error(self, which_mock: Mock):
        with self.assertRaises(PolicyRecognitionError) as exc_info:
            extract_text_from_bytes(b"doc-bytes", "policy.doc")

        self.assertIn("LibreOffice", str(exc_info.exception))
        which_mock.assert_called_once_with("soffice")

    @patch("apps.policies.ai_service.Path.read_text", return_value="Полис DOC")
    @patch("apps.policies.ai_service.Path.exists", return_value=True)
    @patch("apps.policies.ai_service.subprocess.run")
    @patch("apps.policies.ai_service.shutil.which", return_value="/usr/bin/soffice")
    def test_doc_text_is_extracted_via_soffice(
        self,
        which_mock: Mock,
        run_mock: Mock,
        exists_mock: Mock,
        read_text_mock: Mock,
    ):
        text = extract_text_from_bytes(b"doc-bytes", "policy.doc")

        self.assertEqual(text, "Полис DOC")
        which_mock.assert_called_once_with("soffice")
        run_mock.assert_called_once()
        exists_mock.assert_called()
        read_text_mock.assert_called_once_with(encoding="utf-8", errors="ignore")

    @patch(
        "apps.policies.ai_service.subprocess.run",
        side_effect=CalledProcessError(1, ["soffice"]),
    )
    @patch("apps.policies.ai_service.shutil.which", return_value="/usr/bin/soffice")
    def test_doc_failed_conversion_raises_clear_error(
        self, which_mock: Mock, run_mock: Mock
    ):
        with self.assertRaises(PolicyRecognitionError) as exc_info:
            extract_text_from_bytes(b"doc-bytes", "policy.doc")

        self.assertIn("LibreOffice", str(exc_info.exception))
        which_mock.assert_called_once_with("soffice")
        run_mock.assert_called_once()


class PolicyVisionFallbackTests(SimpleTestCase):
    def test_pdf_with_garbled_text_is_poor_text_candidate(self):
        text = "\x04\x05 \x06\x07 abc def ghijk " * 20

        self.assertTrue(is_extracted_policy_text_poor(text))

    @override_settings(POLICY_RECOGNITION_VISION_FALLBACK_ENABLED=True)
    @patch("apps.policies.ai_service.recognize_policy_from_pdf_images")
    @patch("apps.policies.ai_service.recognize_policy_from_text")
    @patch("apps.policies.ai_service.extract_text_from_bytes")
    def test_invalid_text_mode_uses_vision_fallback(
        self,
        extract_mock: Mock,
        text_recognize_mock: Mock,
        vision_recognize_mock: Mock,
    ):
        extract_mock.return_value = (
            "Полис ОСАГО номер SYS-1 страховая премия автомобиль договор"
        )
        text_recognize_mock.side_effect = PolicyRecognitionError("bad json")
        expected = {"policy": {"policy_number": "SYS-1"}, "payments": []}
        vision_recognize_mock.return_value = (expected, "vision transcript")

        data, transcript = recognize_policy_from_bytes(
            b"%PDF",
            filename="policy.pdf",
        )

        self.assertEqual(data, expected)
        self.assertEqual(transcript, "vision transcript")
        vision_recognize_mock.assert_called_once()

    @override_settings(POLICY_RECOGNITION_VISION_FALLBACK_ENABLED=True)
    @patch("apps.policies.ai_service.recognize_policy_from_pdf_images")
    @patch("apps.policies.ai_service.recognize_policy_from_text")
    @patch("apps.policies.ai_service.extract_text_from_bytes")
    def test_empty_text_mode_result_uses_vision_fallback(
        self,
        extract_mock: Mock,
        text_recognize_mock: Mock,
        vision_recognize_mock: Mock,
    ):
        extract_mock.return_value = (
            "Полис ОСАГО номер SYS-1 страховая премия автомобиль договор"
        )
        text_recognize_mock.return_value = (
            {
                "client_name": "",
                "policy": {
                    "policy_number": "",
                    "insurance_type": "",
                    "insurance_company": "",
                    "contractor": "",
                    "sales_channel": "",
                    "start_date": "",
                    "end_date": "",
                    "vehicle_brand": "",
                    "vehicle_model": "",
                    "vehicle_vin": "",
                    "note": "импортировано с помощью ИИ",
                },
                "payments": [],
            },
            "text transcript",
        )
        expected = {"policy": {"policy_number": "SYS-1"}, "payments": []}
        vision_recognize_mock.return_value = (expected, "vision transcript")

        data, transcript = recognize_policy_from_bytes(
            b"%PDF",
            filename="policy.pdf",
        )

        self.assertEqual(data, expected)
        self.assertEqual(transcript, "vision transcript")
        vision_recognize_mock.assert_called_once()

    @override_settings(POLICY_RECOGNITION_VISION_FALLBACK_ENABLED=True)
    @patch("apps.policies.ai_service.recognize_policy_from_pdf_images")
    @patch("apps.policies.ai_service.recognize_policy_from_text")
    @patch("apps.policies.ai_service.extract_text_from_bytes")
    def test_good_text_mode_result_does_not_use_vision(
        self,
        extract_mock: Mock,
        text_recognize_mock: Mock,
        vision_recognize_mock: Mock,
    ):
        extract_mock.return_value = (
            "Полис ОСАГО номер SYS-1 страховая премия автомобиль договор"
        )
        expected = {
            "client_name": "Иванов Иван",
            "policy": {
                "policy_number": "SYS-1",
                "insurance_type": "ОСАГО",
                "insurance_company": "РЕСО",
                "contractor": "",
                "sales_channel": "",
                "start_date": "2026-01-01",
                "end_date": "2027-01-01",
                "vehicle_brand": "",
                "vehicle_model": "",
                "vehicle_vin": "",
                "note": "импортировано с помощью ИИ",
            },
            "payments": [
                {
                    "amount": 1000,
                    "payment_date": "2026-01-01",
                    "actual_payment_date": "2026-01-01",
                }
            ],
        }
        text_recognize_mock.return_value = (expected, "text transcript")

        data, transcript = recognize_policy_from_bytes(
            b"%PDF",
            filename="policy.pdf",
        )

        self.assertEqual(data, expected)
        self.assertEqual(transcript, "text transcript")
        vision_recognize_mock.assert_not_called()

    @override_settings(POLICY_RECOGNITION_MAX_VISION_PAGES=1)
    def test_pdf_render_limits_page_count(self):
        document = pymupdf.open()
        document.new_page().insert_text((72, 72), "Страница 1")
        document.new_page().insert_text((72, 72), "Страница 2")
        content = document.tobytes()
        document.close()

        images = _render_pdf_pages_for_vision(content, "policy.pdf")

        self.assertEqual(len(images), 1)
        self.assertTrue(images[0].startswith(b"\x89PNG"))
