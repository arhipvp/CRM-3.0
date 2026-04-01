from __future__ import annotations

from io import BytesIO
from subprocess import CalledProcessError
from unittest.mock import Mock, patch

from apps.policies.ai_service import PolicyRecognitionError, extract_text_from_bytes
from django.test import SimpleTestCase
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
