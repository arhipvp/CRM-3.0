# -*- coding: utf-8 -*-

import json
from unittest.mock import patch

from apps.policies.ai_service import (
    _extract_vin_from_source_text,
    recognize_policy_interactive,
)
from django.test import SimpleTestCase


class SourceVinExtractionTests(SimpleTestCase):
    def test_extracts_vin_from_glued_token_after_anchor(self) -> None:
        text = (
            "Марка,модель Идентификационный номер Годвыпуска "
            "PORSCHE PANAMERA WP0ZZZYAZSL0609212025353,5"
        )
        self.assertEqual(_extract_vin_from_source_text(text), "WP0ZZZYAZSL060921")

    def test_ignores_tokens_without_vin_anchor(self) -> None:
        text = "Случайная строка ABCDEFGH123456789 без явного поля VIN."
        self.assertEqual(_extract_vin_from_source_text(text), "")


class RecognizePolicyVinFailSoftTests(SimpleTestCase):
    @staticmethod
    def _build_answer(vin: str, brand: str = "PORSCHE", model: str = "PANAMERA") -> str:
        payload = {
            "client_name": "Тестовый клиент",
            "policy": {
                "policy_number": "SYS2884597919",
                "insurance_type": "ОСАГО",
                "insurance_company": "САО «ВСК»",
                "contractor": "",
                "sales_channel": "",
                "start_date": "2025-09-19",
                "end_date": "2026-09-18",
                "vehicle_brand": brand,
                "vehicle_model": model,
                "vehicle_vin": vin,
                "note": "импортировано с помощью ИИ",
            },
            "payments": [
                {
                    "amount": 3168,
                    "payment_date": "2025-09-19",
                    "actual_payment_date": "2025-09-19",
                }
            ],
        }
        return json.dumps(payload, ensure_ascii=False)

    @patch("apps.policies.ai_service._chat")
    def test_recovers_vin_from_source_text_when_model_returns_short_vin(
        self, chat_mock
    ) -> None:
        chat_mock.return_value = self._build_answer("WP0ZZZYAZSL06092")
        text = (
            "Идентификационный номер WP0ZZZYAZSL0609212025353,5 "
            "Полис № SYS2884597919"
        )

        data, _, _ = recognize_policy_interactive(text)

        self.assertEqual(data["policy"]["vehicle_vin"], "WP0ZZZYAZSL060921")
        self.assertEqual(chat_mock.call_count, 1)

    @patch("apps.policies.ai_service._chat")
    def test_clears_invalid_vin_when_source_text_has_no_valid_vin(
        self, chat_mock
    ) -> None:
        chat_mock.return_value = self._build_answer(
            "WP0ZZZYAZSL06092", brand="", model=""
        )
        text = "Текст документа без номера VIN и без идентификационного номера."

        data, _, _ = recognize_policy_interactive(text)

        self.assertEqual(data["policy"]["vehicle_vin"], "")
        self.assertEqual(chat_mock.call_count, 1)

    @patch("apps.policies.ai_service._chat")
    def test_keeps_valid_model_vin_when_source_text_has_no_anchor(
        self, chat_mock
    ) -> None:
        chat_mock.return_value = self._build_answer("WP0ZZZYAZSL060921")
        text = "Документ без поля VIN, но с другими реквизитами."

        data, _, _ = recognize_policy_interactive(text)

        self.assertEqual(data["policy"]["vehicle_vin"], "WP0ZZZYAZSL060921")
