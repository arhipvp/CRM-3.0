from __future__ import annotations

import json
from types import SimpleNamespace
from unittest.mock import Mock, patch

from apps.deals.document_recognition import (
    DocumentRecognitionError,
    recognize_document_from_file,
)
from django.test import SimpleTestCase


def _response_with_json(payload: dict):
    arguments = json.dumps(payload, ensure_ascii=False)
    message = SimpleNamespace(
        tool_calls=[
            SimpleNamespace(function=SimpleNamespace(arguments=arguments)),
        ],
        content="",
    )
    return SimpleNamespace(choices=[SimpleNamespace(message=message)])


class DocumentRecognitionServiceTests(SimpleTestCase):
    @patch("apps.deals.document_recognition._resolve_openrouter_config")
    @patch("apps.deals.document_recognition.openai.OpenAI")
    @patch("apps.deals.document_recognition._render_image_with_rotations")
    def test_image_sent_as_png_data_uri(
        self,
        render_mock: Mock,
        openai_mock: Mock,
        config_mock: Mock,
    ):
        config_mock.return_value = ("key", "https://openrouter.ai/api/v1", "model")
        render_mock.return_value = (b"img-primary", [])
        client = Mock()
        client.chat.completions.create.return_value = _response_with_json(
            {
                "document_type": "passport",
                "confidence": 0.96,
                "warnings": [],
                "data": {},
            }
        )
        openai_mock.return_value = client

        recognize_document_from_file(b"raw-image", "photo.jpg")

        call_kwargs = client.chat.completions.create.call_args.kwargs
        image_url = call_kwargs["messages"][1]["content"][1]["image_url"]["url"]
        self.assertTrue(image_url.startswith("data:image/png;base64,"))

    @patch("apps.deals.document_recognition._resolve_openrouter_config")
    @patch("apps.deals.document_recognition.openai.OpenAI")
    @patch("apps.deals.document_recognition._render_image_with_rotations")
    def test_rotation_fallback_runs_only_for_low_confidence(
        self,
        render_mock: Mock,
        openai_mock: Mock,
        config_mock: Mock,
    ):
        config_mock.return_value = ("key", "https://openrouter.ai/api/v1", "model")
        render_mock.return_value = (b"img-0", [b"img-90", b"img-180"])
        client = Mock()
        client.chat.completions.create.side_effect = [
            _response_with_json(
                {
                    "document_type": "unknown",
                    "confidence": 0.21,
                    "warnings": ["low confidence"],
                    "data": {},
                }
            ),
            _response_with_json(
                {
                    "document_type": "sts",
                    "confidence": 0.89,
                    "warnings": [],
                    "data": {"sts_number": "1234"},
                }
            ),
        ]
        openai_mock.return_value = client

        payload = recognize_document_from_file(b"raw-image", "photo.png")

        self.assertEqual(client.chat.completions.create.call_count, 2)
        self.assertEqual(payload.normalized_type, "sts")

    @patch("apps.deals.document_recognition._resolve_openrouter_config")
    @patch("apps.deals.document_recognition.openai.OpenAI")
    @patch("apps.deals.document_recognition._render_image_with_rotations")
    def test_rotation_fallback_not_used_for_high_confidence(
        self,
        render_mock: Mock,
        openai_mock: Mock,
        config_mock: Mock,
    ):
        config_mock.return_value = ("key", "https://openrouter.ai/api/v1", "model")
        render_mock.return_value = (b"img-0", [b"img-90", b"img-180"])
        client = Mock()
        client.chat.completions.create.return_value = _response_with_json(
            {
                "document_type": "passport",
                "confidence": 0.95,
                "warnings": [],
                "data": {"series": "1234"},
            }
        )
        openai_mock.return_value = client

        payload = recognize_document_from_file(b"raw-image", "photo.png")

        self.assertEqual(client.chat.completions.create.call_count, 1)
        self.assertEqual(payload.normalized_type, "passport")

    @patch("apps.deals.document_recognition._resolve_openrouter_config")
    @patch("apps.deals.document_recognition.time.sleep")
    @patch("apps.deals.document_recognition.openai.OpenAI")
    @patch("apps.deals.document_recognition._render_image_with_rotations")
    def test_retries_on_transient_llm_error(
        self,
        render_mock: Mock,
        openai_mock: Mock,
        sleep_mock: Mock,
        config_mock: Mock,
    ):
        config_mock.return_value = ("key", "https://openrouter.ai/api/v1", "model")
        render_mock.return_value = (b"img-0", [])
        client = Mock()
        client.chat.completions.create.side_effect = [
            RuntimeError("temporary failure"),
            _response_with_json(
                {
                    "document_type": "passport",
                    "confidence": 0.92,
                    "warnings": [],
                    "data": {},
                }
            ),
        ]
        openai_mock.return_value = client

        payload = recognize_document_from_file(b"raw-image", "photo.png")

        self.assertEqual(client.chat.completions.create.call_count, 2)
        self.assertEqual(sleep_mock.call_count, 1)
        self.assertEqual(payload.normalized_type, "passport")

    @patch("apps.deals.document_recognition._resolve_openrouter_config")
    @patch("apps.deals.document_recognition.openai.OpenAI")
    @patch("apps.deals.document_recognition._render_pdf_pages")
    def test_empty_pdf_render_raises_error(
        self,
        render_pdf_mock: Mock,
        openai_mock: Mock,
        config_mock: Mock,
    ):
        config_mock.return_value = ("key", "https://openrouter.ai/api/v1", "model")
        render_pdf_mock.return_value = []
        openai_mock.return_value = Mock()

        with self.assertRaises(DocumentRecognitionError):
            recognize_document_from_file(b"%PDF-1.7 broken", "broken.pdf")

    @patch("apps.deals.document_recognition._resolve_openrouter_config")
    @patch("apps.deals.document_recognition.openai.OpenAI")
    @patch("apps.deals.document_recognition._render_image_with_rotations")
    def test_unknown_custom_type_is_preserved(
        self,
        render_mock: Mock,
        openai_mock: Mock,
        config_mock: Mock,
    ):
        config_mock.return_value = ("key", "https://openrouter.ai/api/v1", "model")
        render_mock.return_value = (b"img-0", [])
        client = Mock()
        client.chat.completions.create.return_value = _response_with_json(
            {
                "document_type": "my_custom_vehicle_doc",
                "confidence": 0.66,
                "warnings": [],
                "data": {},
            }
        )
        openai_mock.return_value = client

        payload = recognize_document_from_file(b"raw-image", "doc.png")

        self.assertEqual(payload.document_type, "my_custom_vehicle_doc")
        self.assertIsNone(payload.normalized_type)

    @patch("apps.deals.document_recognition._resolve_openrouter_config")
    @patch("apps.deals.document_recognition.openai.OpenAI")
    @patch("apps.deals.document_recognition._render_image_with_rotations")
    def test_passport_data_is_inferred_from_extracted_text_when_empty(
        self,
        render_mock: Mock,
        openai_mock: Mock,
        config_mock: Mock,
    ):
        config_mock.return_value = ("key", "https://openrouter.ai/api/v1", "model")
        render_mock.return_value = (b"img-0", [])
        client = Mock()
        client.chat.completions.create.return_value = _response_with_json(
            {
                "document_type": "passport",
                "confidence": 0.95,
                "warnings": [],
                "data": {},
                "extracted_text": (
                    "ГУ МВД РОССИИ ПО МОСКОВСКОЙ ОБЛАСТИ\n"
                    "17.10.2025\n"
                    "500-053\n"
                    "БОРИСОВА\n"
                    "СВЕТЛАНА\n"
                    "ГЕННАДЬЕВНА\n"
                    "46 25 248252\n"
                    "24.04.1995\n"
                    "PNRUSBORISOVA<<SVETLANA<GENNAD9EVNA<<<<<<<<<\n"
                    "4622482523RUS9504246F<<<<<<<5251017500053<44"
                ),
            }
        )
        openai_mock.return_value = client

        payload = recognize_document_from_file(b"raw-image", "passport.jpg")

        self.assertEqual(payload.normalized_type, "passport")
        self.assertEqual(payload.data.get("series"), "4625")
        self.assertEqual(payload.data.get("number"), "248252")
        self.assertEqual(payload.data.get("issuer_code"), "500-053")
        self.assertEqual(payload.data.get("birth_date"), "1995-04-24")
        self.assertEqual(payload.data.get("gender"), "Ж")
        self.assertIn("series", payload.accepted_fields)
        self.assertEqual(payload.rejected_fields, {})

    @patch("apps.deals.document_recognition._resolve_openrouter_config")
    @patch("apps.deals.document_recognition.openai.OpenAI")
    @patch("apps.deals.document_recognition._render_image_with_rotations")
    def test_passport_registration_page_does_not_set_issue_date(
        self,
        render_mock: Mock,
        openai_mock: Mock,
        config_mock: Mock,
    ):
        config_mock.return_value = ("key", "https://openrouter.ai/api/v1", "model")
        render_mock.return_value = (b"img-0", [])
        client = Mock()
        client.chat.completions.create.return_value = _response_with_json(
            {
                "document_type": "passport",
                "confidence": 0.9,
                "warnings": [],
                "data": {"issue_date": "22.04.2025"},
                "extracted_text": (
                    "МЕСТО ЖИТЕЛЬСТВА\n"
                    "ЗАРЕГИСТРИРОВАН\n"
                    "22.04.2025\n"
                    "Г. МОСКВА, УЛ. АРТЮХИНОЙ, Д. 25 К. 2, КВ. 77\n"
                    "ОТДЕЛ ПО ВОПРОСАМ МИГРАЦИИ"
                ),
            }
        )
        openai_mock.return_value = client

        payload = recognize_document_from_file(
            b"raw-image", "passport-registration.jpg"
        )

        self.assertEqual(payload.normalized_type, "passport")
        self.assertNotIn("issue_date", payload.data)
        self.assertIn("registration_address", payload.data)
        self.assertIn("issue_date", payload.rejected_fields)

    @patch("apps.deals.document_recognition._resolve_openrouter_config")
    @patch("apps.deals.document_recognition.openai.OpenAI")
    @patch("apps.deals.document_recognition._render_image_with_rotations")
    def test_sts_invalid_vin_is_rejected(
        self,
        render_mock: Mock,
        openai_mock: Mock,
        config_mock: Mock,
    ):
        config_mock.return_value = ("key", "https://openrouter.ai/api/v1", "model")
        render_mock.return_value = (b"img-0", [])
        client = Mock()
        client.chat.completions.create.return_value = _response_with_json(
            {
                "document_type": "sts",
                "confidence": 0.88,
                "warnings": [],
                "data": {
                    "vin": "BAD-VIN",
                    "sts_series": "50ТТ",
                    "sts_number": "123456",
                },
                "extracted_text": "СТС",
            }
        )
        openai_mock.return_value = client

        payload = recognize_document_from_file(b"raw-image", "sts.jpg")

        self.assertEqual(payload.normalized_type, "sts")
        self.assertNotIn("vin", payload.data)
        self.assertIn("vin", payload.rejected_fields)
        self.assertEqual(payload.data.get("sts_series"), "50ТТ")
        self.assertEqual(payload.data.get("sts_number"), "123456")

    @patch("apps.deals.document_recognition._resolve_openrouter_config")
    @patch("apps.deals.document_recognition.openai.OpenAI")
    @patch("apps.deals.document_recognition._render_image_with_rotations")
    def test_sts_data_is_inferred_from_extracted_text_when_empty(
        self,
        render_mock: Mock,
        openai_mock: Mock,
        config_mock: Mock,
    ):
        config_mock.return_value = ("key", "https://openrouter.ai/api/v1", "model")
        render_mock.return_value = (b"img-0", [])
        client = Mock()
        client.chat.completions.create.return_value = _response_with_json(
            {
                "document_type": "sts",
                "confidence": 0.9,
                "warnings": [],
                "data": {},
                "extracted_text": (
                    "ГОСУДАРСТВЕННЫЙ РЕГИСТРАЦИОННЫЙ НОМЕР\n"
                    "C116CB797\n"
                    "МАРКА HONDA STEPWGN\n"
                    "МОДЕЛЬ HONDA STEPWGN\n"
                    "ТИП ТС ЛЕГКОВОЙ ПРОЧЕЕ\n"
                    "ГОД ВЫПУСКА ТС 2018\n"
                    "ЦВЕТ БЕЛЫЙ\n"
                    "ТЕХНИЧЕСКИ ДОПУСТИМАЯ МАКС. МАССА, КГ 2163\n"
                    "МАССА В СНАРЯЖЕННОМ СОСТОЯНИИ, КГ 1680\n"
                    "99 72 941313\n"
                    "СОБСТВЕННИК\n"
                    "КАЛАШНИКОВ\n"
                    "МАКСИМ\n"
                    "МИХАЙЛОВИЧ\n"
                    "КОД ПОДРАЗДЕЛЕНИЯ ГИБДД 1145044\n"
                    "ДАТА ВЫДАЧИ 15.03.2025\n"
                ),
            }
        )
        openai_mock.return_value = client

        payload = recognize_document_from_file(b"raw-image", "sts.jpg")

        self.assertEqual(payload.normalized_type, "sts")
        self.assertEqual(payload.data.get("sts_series"), "9972")
        self.assertEqual(payload.data.get("sts_number"), "941313")
        self.assertEqual(payload.data.get("plate_number"), "C116CB797")
        self.assertEqual(payload.data.get("vehicle_brand"), "HONDA STEPWGN")
        self.assertEqual(payload.data.get("vehicle_model"), "HONDA STEPWGN")
        self.assertEqual(payload.data.get("year"), 2018)
        self.assertEqual(payload.data.get("issue_date"), "2025-03-15")
        self.assertEqual(payload.data.get("issued_by"), "1145044")
        self.assertEqual(payload.data.get("owner"), "КАЛАШНИКОВ МАКСИМ МИХАЙЛОВИЧ")

    @patch("apps.deals.document_recognition._resolve_openrouter_config")
    @patch("apps.deals.document_recognition.openai.OpenAI")
    @patch("apps.deals.document_recognition._render_image_with_rotations")
    def test_passport_full_name_ignores_service_words(
        self,
        render_mock: Mock,
        openai_mock: Mock,
        config_mock: Mock,
    ):
        config_mock.return_value = ("key", "https://openrouter.ai/api/v1", "model")
        render_mock.return_value = (b"img-0", [])
        client = Mock()
        client.chat.completions.create.return_value = _response_with_json(
            {
                "document_type": "passport",
                "confidence": 0.9,
                "warnings": [],
                "data": {"full_name": "ПОССИЙСКАЯ ОБЛАСТИ БОРИСОВА"},
                "extracted_text": (
                    "ГУ МВД РОССИИ ПО МОСКОВСКОЙ ОБЛАСТИ\n"
                    "БОРИСОВА\n"
                    "СВЕТЛАНА\n"
                    "ГЕННАДЬЕВНА"
                ),
            }
        )
        openai_mock.return_value = client

        payload = recognize_document_from_file(b"raw-image", "passport-main.jpg")

        self.assertEqual(payload.data.get("full_name"), "БОРИСОВА СВЕТЛАНА ГЕННАДЬЕВНА")
        self.assertIn("full_name", payload.rejected_fields)
