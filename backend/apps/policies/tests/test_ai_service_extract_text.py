from __future__ import annotations

from io import BytesIO
from subprocess import CalledProcessError
from unittest.mock import Mock, patch

import pymupdf
from apps.policies.ai_service import (
    PolicyRecognitionError,
    _build_vision_messages,
    _prepare_image_for_vision,
    _render_pdf_pages_for_vision,
    _resolve_ai_client_config,
    extract_text_from_bytes,
    is_extracted_policy_text_poor,
    recognize_policy_from_bytes,
)
from django.test import SimpleTestCase, override_settings
from docx import Document
from PIL import Image


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
    def _image_bytes(
        self, image_format: str = "PNG", *, orientation: int | None = None
    ):
        image = Image.new("RGB", (20, 10), "white")
        buffer = BytesIO()
        save_args = {}
        if orientation is not None:
            exif = Image.Exif()
            exif[274] = orientation
            save_args["exif"] = exif
        image.save(buffer, format=image_format, **save_args)
        return buffer.getvalue()

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

    @override_settings(POLICY_RECOGNITION_MAX_IMAGE_DIMENSION=2048)
    def test_jpeg_is_normalized_and_exif_orientation_is_applied(self):
        normalized = _prepare_image_for_vision(
            self._image_bytes("JPEG", orientation=6), "policy.jpg"
        )

        with Image.open(BytesIO(normalized)) as image:
            self.assertEqual(image.format, "JPEG")
            self.assertEqual(image.size, (10, 20))

    def test_png_is_normalized_for_vision(self):
        normalized = _prepare_image_for_vision(self._image_bytes(), "policy.png")

        with Image.open(BytesIO(normalized)) as image:
            self.assertEqual(image.format, "JPEG")
            self.assertEqual(image.size, (20, 10))

    @override_settings(POLICY_RECOGNITION_MAX_IMAGE_DIMENSION=100)
    def test_image_is_resized_to_configured_max_dimension(self):
        image = Image.new("RGB", (400, 200), "white")
        source = BytesIO()
        image.save(source, format="JPEG")

        normalized = _prepare_image_for_vision(source.getvalue(), "policy.jpg")

        with Image.open(BytesIO(normalized)) as prepared:
            self.assertEqual(prepared.size, (100, 50))

    def test_image_with_alpha_stays_png(self):
        image = Image.new("RGBA", (20, 10), (255, 255, 255, 0))
        source = BytesIO()
        image.save(source, format="PNG")

        normalized = _prepare_image_for_vision(source.getvalue(), "policy.png")

        self.assertTrue(normalized.startswith(b"\x89PNG"))

    @override_settings(
        POLICY_RECOGNITION_MODEL="google/gemini-2.5-pro",
        OPENROUTER_MODEL="gpt-4o-mini",
        OPENROUTER_API_KEY="test-key",  # pragma: allowlist secret
    )
    def test_policy_model_has_priority_over_common_model(self):
        _, _, model = _resolve_ai_client_config()

        self.assertEqual(model, "google/gemini-2.5-pro")

    @override_settings(
        POLICY_RECOGNITION_MODEL="",
        OPENROUTER_MODEL="gpt-4o-mini",
        OPENROUTER_API_KEY="test-key",
    )
    def test_policy_model_falls_back_to_common_model(self):
        _, _, model = _resolve_ai_client_config()

        self.assertEqual(model, "gpt-4o-mini")

    def test_broken_image_raises_clear_error(self):
        with self.assertRaises(PolicyRecognitionError) as exc_info:
            _prepare_image_for_vision(b"not-an-image", "broken.png")

        self.assertIn("Не удалось подготовить изображение", str(exc_info.exception))

    def test_unsupported_image_format_raises_clear_error(self):
        with self.assertRaises(PolicyRecognitionError) as exc_info:
            _prepare_image_for_vision(b"image", "policy.webp")

        self.assertIn("Неподдерживаемый формат", str(exc_info.exception))

    @override_settings(POLICY_RECOGNITION_MAX_VISION_PAGES=1)
    def test_pdf_and_images_share_visual_input_limit(self):
        document = pymupdf.open()
        document.new_page().insert_text((72, 72), "Page 1")
        pdf_content = document.tobytes()
        document.close()

        messages, _ = _build_vision_messages(
            [
                {"name": "first.png", "content": self._image_bytes()},
                {"name": "second.pdf", "content": pdf_content},
            ]
        )

        user_content = messages[1]["content"]
        self.assertEqual(sum(item["type"] == "image_url" for item in user_content), 1)
