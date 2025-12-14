# -*- coding: utf-8 -*-

from apps.policies.ai_service import _extract_json_from_answer
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
