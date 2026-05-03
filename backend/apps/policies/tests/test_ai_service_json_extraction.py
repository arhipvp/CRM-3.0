# -*- coding: utf-8 -*-

import json

from apps.policies.ai_service import _extract_json_from_answer, _parse_policy_answer
from django.test import SimpleTestCase


class ExtractJsonFromAnswerTests(SimpleTestCase):
    def test_extracts_plain_json(self) -> None:
        raw = '{"a": 1, "b": {"c": 2}}'
        self.assertEqual(_extract_json_from_answer(raw), raw)

    def test_extracts_from_code_fence(self) -> None:
        raw = '```json\n{"a": 1}\n```'
        self.assertEqual(_extract_json_from_answer(raw), '{"a": 1}')

    def test_extracts_from_code_fence_without_language(self) -> None:
        raw = '```\n{"a": 1}\n```'
        self.assertEqual(_extract_json_from_answer(raw), '{"a": 1}')

    def test_extracts_from_text_wrapped_json(self) -> None:
        raw = 'Вот JSON:\n{"a": 1}\nСпасибо.'
        self.assertEqual(_extract_json_from_answer(raw), '{"a": 1}')

    def test_strips_bom(self) -> None:
        raw = '\ufeff```json\n{"a": 1}\n```'
        self.assertEqual(_extract_json_from_answer(raw), '{"a": 1}')


class PolicyAiCascoFieldsTests(SimpleTestCase):
    def _payload(self, **policy_overrides) -> str:
        policy = {
            "policy_number": "CASCO-1",
            "insurance_type": "КАСКО",
            "insurance_company": "Ингосстрах",
            "contractor": "",
            "sales_channel": "",
            "start_date": "2026-01-01",
            "end_date": "2026-12-31",
            "vehicle_brand": "Hyundai",
            "vehicle_model": "Solaris",
            "vehicle_vin": "Z94CB41ABFR123456",
            "deductible": "15 000 ₽",
            "official_dealer": "",
            "gap": False,
            "note": "другое значение",
        }
        policy.update(policy_overrides)
        return json.dumps(
            {
                "client_name": "Тестовый клиент",
                "policy": policy,
                "payments": [
                    {
                        "amount": "2000 руб.",
                        "payment_date": "01.01.2026",
                        "actual_payment_date": "",
                    }
                ],
            },
            ensure_ascii=False,
        )

    def test_parse_policy_answer_accepts_and_normalizes_casco_fields(self) -> None:
        data = _parse_policy_answer(self._payload(official_dealer="да", gap="есть"))

        policy = data["policy"]
        self.assertEqual(policy["deductible"], "15000")
        self.assertIs(policy["official_dealer"], True)
        self.assertIs(policy["gap"], True)
        self.assertEqual(policy["note"], "импортировано с помощью ИИ")

    def test_parse_policy_answer_defaults_unknown_casco_fields(self) -> None:
        data = _parse_policy_answer(
            self._payload(deductible="", official_dealer="", gap="")
        )

        policy = data["policy"]
        self.assertEqual(policy["deductible"], "0")
        self.assertEqual(policy["official_dealer"], "")
        self.assertIs(policy["gap"], False)

    def test_parse_policy_answer_resets_casco_fields_for_non_casco(self) -> None:
        data = _parse_policy_answer(
            self._payload(
                insurance_type="ОСАГО",
                deductible=30000,
                official_dealer=True,
                gap=True,
            )
        )

        policy = data["policy"]
        self.assertEqual(policy["deductible"], "0")
        self.assertEqual(policy["official_dealer"], "")
        self.assertIs(policy["gap"], False)
