# -*- coding: utf-8 -*-

import json
from io import BytesIO
from unittest.mock import patch

from apps.policies.ai_service import (
    _build_prompt,
    recognize_policy_from_pdf_images,
    recognize_policy_interactive,
)
from django.test import SimpleTestCase
from PIL import Image


class RecognizePolicyAiVerificationTests(SimpleTestCase):
    @staticmethod
    def _build_answer(
        vin: str,
        *,
        insurance_type: str = "ОСАГО",
        start_date: str = "2025-09-19",
        end_date: str = "2026-09-18",
    ) -> str:
        payload = {
            "client_name": "Тестовый клиент",
            "policy": {
                "policy_number": "SYS2884597919",
                "insurance_type": insurance_type,
                "insurance_company": "САО «ВСК»",
                "contractor": "",
                "sales_channel": "",
                "start_date": start_date,
                "end_date": end_date,
                "vehicle_brand": "PORSCHE",
                "vehicle_model": "PANAMERA",
                "vehicle_vin": vin,
                "deductible": 0,
                "official_dealer": "",
                "gap": False,
                "note": "импортировано с помощью ИИ",
            },
            "payments": [
                {
                    "amount": 3168,
                    "payment_date": start_date,
                    "actual_payment_date": start_date,
                }
            ],
        }
        return json.dumps(payload, ensure_ascii=False)

    @patch("apps.policies.ai_service._chat")
    def test_second_ai_pass_corrects_formal_vin_issue(self, chat_mock) -> None:
        chat_mock.side_effect = [
            self._build_answer("WP0ZZZYAZSL06092"),
            self._build_answer("WP0ZZZYAZSL060921"),
        ]
        text = (
            "Идентификационный номер WP0ZZZYAZSL0609212025353,5 "
            "Полис № SYS2884597919"
        )

        data, transcript, messages = recognize_policy_interactive(text)

        self.assertEqual(data["policy"]["vehicle_vin"], "WP0ZZZYAZSL060921")
        self.assertEqual(chat_mock.call_count, 2)
        verification_message = messages[-2]["content"]
        self.assertIn("Формальные замечания CRM", verification_message)
        self.assertIn("vehicle_vin", verification_message)
        self.assertEqual(transcript, "")

    @patch("apps.policies.ai_service._chat")
    def test_dgo_type_comes_from_ai_using_catalog_descriptions(self, chat_mock) -> None:
        chat_mock.side_effect = [
            self._build_answer("", insurance_type=""),
            self._build_answer("", insurance_type="ДГО/ДСАГО"),
        ]
        text = (
            "Полис РЕСОавто. Правила страхования гражданской ответственности "
            "автовладельцев. Страховая сумма 1000000.00 руб."
        )

        data, _, _ = recognize_policy_interactive(
            text,
            extra_types=[
                {
                    "name": "ДГО/ДСАГО",
                    "description": (
                        "добровольная дополнительная гражданская ответственность "
                        "автовладельца сверх ОСАГО"
                    ),
                },
                {"name": "ОСАГО", "description": "обязательное страхование"},
            ],
        )

        self.assertEqual(data["policy"]["insurance_type"], "ДГО/ДСАГО")
        first_call_messages = chat_mock.call_args_list[0].args[0]
        self.assertIn("ДГО/ДСАГО: добровольная", first_call_messages[0]["content"])

    @patch("apps.policies.ai_service._chat")
    def test_verification_pass_receives_same_images_as_extraction(
        self, chat_mock
    ) -> None:
        chat_mock.side_effect = [
            self._build_answer("WP0ZZZYAZSL060921"),
            self._build_answer("WP0ZZZYAZSL060921"),
        ]
        image = Image.new("RGB", (20, 10), "white")
        buffer = BytesIO()
        image.save(buffer, format="JPEG")

        recognize_policy_from_pdf_images(
            [{"name": "policy.jpg", "content": buffer.getvalue(), "text": ""}]
        )

        extraction_messages = chat_mock.call_args_list[0].args[0]
        verification_messages = chat_mock.call_args_list[1].args[0]
        extraction_images = [
            item
            for item in extraction_messages[1]["content"]
            if item["type"] == "image_url"
        ]
        verification_images = [
            item
            for item in verification_messages[1]["content"]
            if item["type"] == "image_url"
        ]
        self.assertEqual(verification_images, extraction_images)

    def test_prompt_adds_default_descriptions_for_known_type_names(self) -> None:
        prompt = _build_prompt(extra_types=["ОСАГО", "ДГО/ДСАГО"])

        self.assertIn("ОСАГО: обязательное страхование", prompt)
        self.assertIn("ДГО/ДСАГО: добровольная дополнительная", prompt)
