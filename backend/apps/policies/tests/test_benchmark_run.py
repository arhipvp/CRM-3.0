import base64
import json
import tempfile
from decimal import Decimal
from io import BytesIO
from pathlib import Path
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import Mock, patch

import httpx
from apps.policies.benchmark_core import BudgetError, BudgetLedger
from apps.policies.benchmark_run import (
    MODELS,
    PaidCaller,
    choose_routes,
    evaluate_answer,
    main,
    request_parameters,
    response_cost,
    selected_models,
    upper_cost,
)
from openai import APIConnectionError
from PIL import Image


def route():
    return {
        "name": "test-provider",
        "context_length": 1000000,
        "max_completion_tokens": 16000,
        "supported_parameters": ["tools", "tool_choice", "temperature"],
        "pricing": {
            "currency": "RUB",
            "prompt_per_million": "10",
            "completion_per_million": "30",
            "image_input_per_million": "10",
        },
    }


class BenchmarkRunnerTests(TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.ledger = BudgetLedger(Path(self.directory.name) / "ledger.json")
        self.create = Mock()
        client = SimpleNamespace(
            chat=SimpleNamespace(completions=SimpleNamespace(create=self.create))
        )
        self.caller = PaidCaller(client, self.ledger)

    def test_resume_returns_saved_response_without_duplicate_payment(self):
        payload = {"usage": {"cost_rub": 0.1}, "choices": []}
        self.create.return_value.model_dump.return_value = payload
        first = self.caller.call("case:model:extract", "1", {})
        self.assertEqual(self.caller.call("case:model:extract", "1", {}), first)
        self.assertEqual(self.create.call_count, 1)
        self.assertEqual(self.ledger.summary()["spent"], Decimal("0.1"))

    def test_unknown_cost_stops_and_never_repeats_call(self):
        self.create.return_value.model_dump.return_value = {"usage": {"cost": 0.1}}
        with self.assertRaises(BudgetError):
            self.caller.call("a", "1", {})
        with self.assertRaises(BudgetError):
            self.caller.call("a", "1", {})
        with self.assertRaises(BudgetError):
            self.caller.call("b", "1", {})
        self.assertEqual(self.create.call_count, 1)

    def test_network_error_leaves_unknown_charge_without_sdk_retry(self):
        self.create.side_effect = APIConnectionError(
            request=httpx.Request("POST", "https://example.test")
        )
        with self.assertRaises(BudgetError):
            self.caller.call("a", "1", {})
        self.assertEqual(self.ledger.get("a")["state"], "unknown")
        self.assertEqual(self.create.call_count, 1)

    def test_over_budget_stops_before_api(self):
        with self.assertRaises(BudgetError):
            self.caller.call("a", "271", {})
        self.create.assert_not_called()

    def test_reserved_crash_record_is_not_replayed(self):
        self.ledger.reserve("a", "1")
        with self.assertRaises(BudgetError):
            self.caller.call("a", "1", {})
        self.create.assert_not_called()

    def test_invalid_json_is_zero_score_and_has_no_raw_error_text(self):
        ai = Mock()
        ai._parse_policy_answer.side_effect = json.JSONDecodeError(
            "private text", "doc", 0
        )
        result = evaluate_answer(
            ai,
            "not-json",
            "private source",
            {"dates": {"policy.start_date": "2026-09-01"}},
        )
        self.assertFalse(result["valid"])
        self.assertEqual(result["score"]["score"], 0)
        self.assertEqual(result["validation_error"], "JSONDecodeError")
        ai._validate_policy_payload.assert_not_called()

    def test_only_compatible_rub_routes_are_selected(self):
        invalid = route()
        invalid["pricing"]["currency"] = "USD"
        catalog = {
            "data": [
                {
                    "id": MODELS[0],
                    "architecture": {"input_modalities": ["text", "image"]},
                    "providers": [invalid, route()],
                }
            ]
        }
        routes = choose_routes(catalog)
        self.assertEqual(routes[MODELS[0]]["name"], "test-provider")
        self.assertIn("unavailable", routes[MODELS[1]])

    def test_text_route_does_not_need_explicit_image_price(self):
        provider = route()
        del provider["pricing"]["image_input_per_million"]
        catalog = {
            "data": [
                {
                    "id": MODELS[4],
                    "architecture": {"input_modalities": ["text", "image"]},
                    "providers": [provider],
                }
            ]
        }
        self.assertNotIn("unavailable", choose_routes(catalog)[MODELS[4]])
        self.assertGreater(
            upper_cost(MODELS[4], provider, [{"role": "user", "content": "text"}], {}),
            0,
        )
        image = BytesIO()
        Image.new("RGB", (16, 16)).save(image, format="PNG")
        messages = [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": "data:image/png;base64,"
                            + base64.b64encode(image.getvalue()).decode("ascii")
                        },
                    }
                ],
            }
        ]
        with self.assertRaises(BudgetError):
            upper_cost(MODELS[4], provider, messages, {})

    def test_byte_bound_above_context_reserves_context_not_rejects(self):
        provider = route()
        provider["context_length"] = 128000
        estimate = upper_cost(
            MODELS[4], provider, [{"role": "user", "content": "a" * 200000}], {}
        )
        self.assertGreater(estimate, 0)
        self.assertLess(estimate, Decimal("2"))

    def test_request_pins_route_and_disables_fallback(self):
        params = request_parameters(MODELS[0], route(), [], {"name": "policy"})
        self.assertEqual(
            params["extra_body"]["provider"],
            {
                "only": ["test-provider"],
                "allow_fallbacks": False,
                "require_parameters": True,
            },
        )
        self.assertEqual(params["tool_choice"]["function"]["name"], "policy")

    def test_estimation_is_offline_and_bounded(self):
        estimate = upper_cost(
            MODELS[0],
            route(),
            [{"role": "user", "content": "test"}],
            {"name": "policy"},
        )
        self.assertGreater(estimate, 0)
        self.create.assert_not_called()
        self.assertFalse(self.ledger.path.exists())

    def test_cost_rejects_nonfinite_and_usd_ambiguous_field(self):
        self.assertIsNone(response_cost({"usage": {"cost_rub": "NaN"}}))
        self.assertIsNone(response_cost({"usage": {"cost": "0.1"}}))

    def test_stage_two_requires_complete_candidates(self):
        with self.assertRaises(BudgetError):
            selected_models(2, [], [{"id": "c1", "stage": 1}])

    def test_dry_run_never_creates_paid_client_or_ledger(self):
        root = Path(self.directory.name)
        (root / "c1").mkdir()
        documents = {
            "context.json": {
                "extract_prompt": "extract",
                "verify_prompt": "verify",
                "function": {"name": "policy"},
            },
            "manifest.json": [{"id": "c1", "category": "test", "stage": 1}],
            "gold.json": {"c1": {"dates": {"policy.start_date": "2026-09-01"}}},
            "c1/source.json": {"extracted": "fixture", "poor": False},
        }
        for path, value in documents.items():
            (root / path).write_text(json.dumps(value), encoding="utf-8")
        (root / "c1/source.pdf").write_bytes(b"fixture-not-rendered")
        catalog = {
            "data": [
                {
                    "id": MODELS[0],
                    "architecture": {"input_modalities": ["image", "text"]},
                    "providers": [route()],
                }
            ]
        }
        with patch("apps.policies.benchmark_run.httpx.Client") as http, patch(
            "apps.policies.benchmark_run.OpenAI"
        ) as paid:
            http.return_value.__enter__.return_value.get.return_value.json.return_value = (
                catalog
            )
            self.assertEqual(
                main(["--run-dir", str(root), "--stage", "1", "--dry-run"]), 0
            )
            paid.assert_not_called()
        self.assertFalse((root / "ledger.json").exists())
        self.assertTrue((root / "stage-1-estimates.json").exists())

    def test_reconciled_transient_error_allows_only_one_new_attempt(self):
        self.ledger.reserve("a", "1")
        self.ledger.settle(
            "a", "0", outcome="provider_error", result={"http_status": 429}
        )
        payload = {"usage": {"cost_rub": "0.2"}, "choices": []}
        self.create.return_value.model_dump.return_value = payload
        first = self.caller.call("a", "1", {})
        self.assertEqual(self.caller.call("a", "1", {}), first)
        self.assertEqual(self.create.call_count, 1)
        self.assertEqual(self.ledger.get("a:retry1")["state"], "settled")
