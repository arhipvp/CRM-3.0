import json
import os
from decimal import Decimal
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase

from apps.policies.benchmark_core import (
    BudgetError,
    BudgetLedger,
    DuplicateRequest,
    sanitize,
    score_prediction,
    should_retry,
)


class BudgetLedgerTests(TestCase):
    def setUp(self):
        self.directory = TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.path = Path(self.directory.name) / "private" / "ledger.json"
        self.ledger = BudgetLedger(self.path)

    def test_reservation_is_durable_and_blocks_other_calls(self):
        self.ledger.reserve("first", "12.30")
        resumed = BudgetLedger(self.path)
        self.assertEqual(resumed.get("first")["state"], "reserved")
        self.assertEqual(resumed.summary()["reserved"], Decimal("12.30"))
        with self.assertRaises(DuplicateRequest):
            resumed.reserve("first", "12.30")
        with self.assertRaises(BudgetError):
            resumed.reserve("second", "1")

    def test_settled_result_resumes_without_duplicate_payment(self):
        self.ledger.reserve("first", "3")
        self.ledger.settle("first", "0.15", result={"answer": "saved"})
        resumed = BudgetLedger(self.path)
        self.assertEqual(resumed.get("first")["result"], {"answer": "saved"})
        self.assertEqual(resumed.summary()["spent"], Decimal("0.15"))
        with self.assertRaises(DuplicateRequest):
            resumed.reserve("first", "1")
        with self.assertRaises(DuplicateRequest):
            resumed.settle("first", "0.15")
        resumed.reserve("second", "1")

    def test_exact_decimal_budget_and_thirty_ruble_reserve(self):
        self.ledger.reserve("first", "269.90")
        self.ledger.settle("first", "269.90")
        with self.assertRaises(BudgetError):
            self.ledger.reserve("too-much", "0.11")
        self.ledger.reserve("last", "0.10")
        self.ledger.settle("last", "0.10")
        self.assertEqual(self.ledger.summary()["spent"], Decimal("270.00"))
        with self.assertRaises(BudgetError):
            self.ledger.reserve("spend-reserve", "0.01")

    def test_unknown_error_charge_stops_until_reconciled(self):
        self.ledger.reserve("first", "3")
        self.ledger.settle("first", None, outcome="network_error")
        with self.assertRaises(BudgetError):
            self.ledger.reserve("retry", "3")
        self.ledger.settle("first", "0.10", outcome="network_error")
        self.ledger.reserve("retry", "3")
        self.ledger.settle("retry", "0.20")
        self.assertEqual(self.ledger.summary()["spent"], Decimal("0.30"))

    def test_reconciliation_keeps_saved_response(self):
        self.ledger.reserve("first", "3")
        self.ledger.settle("first", None, result={"answer": "persisted"})
        self.ledger.settle("first", "0.1")
        self.assertEqual(self.ledger.get("first")["result"], {"answer": "persisted"})

    def test_missing_or_invalid_price_fails_before_call(self):
        for value in (None, "unknown", "NaN", "Infinity", "-1", "0"):
            with self.subTest(value=value), self.assertRaises(BudgetError):
                self.ledger.reserve("first", value)
        self.assertFalse(self.path.exists())

    def test_estimate_overrun_is_saved_and_halts_run(self):
        self.ledger.reserve("first", "1")
        with self.assertRaises(BudgetError):
            self.ledger.settle("first", "1.01")
        self.assertEqual(self.ledger.summary()["spent"], Decimal("1.01"))
        with self.assertRaises(BudgetError):
            self.ledger.reserve("second", "1")

    def test_limits_cannot_change_during_resume(self):
        self.ledger.reserve("first", "1")
        with self.assertRaises(BudgetError):
            BudgetLedger(self.path, working_limit="300").summary()
        with self.assertRaises(BudgetError):
            BudgetLedger(self.path, working_limit="301", hard_limit="300")
        with self.assertRaises(BudgetError):
            BudgetLedger(self.path, working_limit="400", hard_limit="500")

    def test_corrupt_ledger_fails_closed(self):
        self.path.parent.mkdir()
        self.path.write_text("not JSON", encoding="utf-8")
        with self.assertRaises(BudgetError):
            self.ledger.reserve("first", "1")

    def test_lock_prevents_parallel_reservations(self):
        self.path.parent.mkdir()
        lock = self.path.with_suffix(".json.lock")
        lock.touch()
        with self.assertRaises(BudgetError):
            self.ledger.reserve("first", "1")
        self.assertTrue(lock.exists())

    def test_sensitive_values_not_persisted_but_document_text_kept(self):
        credential = "example-" + "credential-for-tests"
        ledger = BudgetLedger(self.path, secrets=(credential,))
        ledger.reserve("first", "1", metadata={"authorization": credential})
        ledger.settle(
            "first", "0.1", result={"document": "Policy text", "message": credential}
        )
        serialized = self.path.read_text(encoding="utf-8")
        self.assertNotIn(credential, serialized)
        self.assertIn("Policy text", serialized)
        self.assertEqual(json.loads(serialized)["version"], 1)
        if os.name != "nt":
            self.assertEqual(self.path.stat().st_mode & 0o777, 0o600)
            self.assertEqual(self.path.parent.stat().st_mode & 0o777, 0o700)

    def test_credentials_cannot_be_used_as_request_identifier(self):
        with self.assertRaises(BudgetError):
            self.ledger.reserve("pza_" + "sample-not-real", "1")


class RetryAndSanitizationTests(TestCase):
    def test_only_one_transient_retry(self):
        for status in (429, 500, 502, 503, 599):
            self.assertTrue(should_retry(0, status))
            self.assertFalse(should_retry(1, status))
        self.assertTrue(should_retry(0, network_error=True))
        self.assertFalse(should_retry(1, network_error=True))
        for status in (None, 400, 401, 402, 403, 408, 600):
            self.assertFalse(should_retry(0, status))

    def test_recursive_credentials_and_embedded_bearer_redaction(self):
        token = "pza_" + "sample-not-real"
        data = {
            "headers": {"Authorization": "Bearer " + token},
            "nested": [{"AI_API_KEY": token}],
            "message": "Failure with " + token,
            "pii": "Example policyholder",
            "base64": "JVBERi0xLjQ=",
        }
        result = sanitize(data)
        serialized = json.dumps(result)
        self.assertNotIn(token, serialized)
        self.assertNotIn("Bearer ", serialized)
        self.assertEqual(result["pii"], data["pii"])
        self.assertEqual(result["base64"], data["base64"])


class BenchmarkScoringTests(TestCase):
    def setUp(self):
        self.gold = {
            "dates": {
                "policy.start_date": "2026-09-04",
                "policy.end_date": "2027-09-03",
                "payments.0.payment_date": "2026-09-04",
                "payments.0.actual_payment_date": "2026-09-03",
            },
            "money": {"payments.0.amount": "9024.35", "payments.length": 1},
            "other": {"policy.policy_number": "POLICY123", "policy.vehicle_vin": ""},
            "critical_date_paths": ["policy.start_date", "policy.end_date"],
        }
        self.prediction = {
            "policy": {
                "start_date": "2026-09-04",
                "end_date": "2027-09-03",
                "policy_number": "POLICY123",
                "vehicle_vin": "",
            },
            "payments": [
                {
                    "payment_date": "2026-09-04",
                    "actual_payment_date": "2026-09-03",
                    "amount": 9024.35,
                }
            ],
        }

    def test_exact_answer_scores_one_hundred_without_changing_actual_date(self):
        result = score_prediction(self.prediction, self.gold)
        self.assertEqual(result["score"], 100)
        self.assertTrue(result["first_payment_matches_start"])
        self.assertEqual(result["critical_date_errors"], 0)
        self.assertNotIn("POLICY123", json.dumps(result))

    def test_wrong_year_is_error_even_when_day_and_month_match(self):
        self.prediction["policy"]["start_date"] = "2023-09-04"
        result = score_prediction(self.prediction, self.gold)
        self.assertEqual(result["score"], 87.5)
        self.assertEqual(result["critical_date_errors"], 1)
        self.assertFalse(result["first_payment_matches_start"])

    def test_date_formats_and_nonexistent_dates_are_not_accepted(self):
        for value in ("04.09.2026", "20260904", "2026-02-30", "2026-09-04T00:00:00"):
            with self.subTest(value=value):
                self.prediction["policy"]["start_date"] = value
                result = score_prediction(self.prediction, self.gold)
                self.assertEqual(result["critical_date_errors"], 1)

    def test_date_money_other_weights(self):
        self.prediction["payments"][0]["amount"] = 1
        self.prediction["policy"]["policy_number"] = "wrong"
        result = score_prediction(self.prediction, self.gold)
        self.assertEqual(result["score"], 75)

    def test_invalid_json_or_schema_is_zero_including_blank_expected_fields(self):
        result = score_prediction(self.prediction, self.gold, valid=False)
        self.assertEqual(result["score"], 0)
        self.assertEqual(result["critical_date_errors"], 2)
        self.assertEqual(score_prediction(None, self.gold)["score"], 0)

    def test_missing_and_unsupported_are_separate_from_wrong_values(self):
        del self.prediction["policy"]["policy_number"]
        self.prediction["policy"]["vehicle_vin"] = "NOT-IN-DOCUMENT"
        self.prediction["payments"][0]["amount"] = 100
        result = score_prediction(self.prediction, self.gold)
        self.assertEqual(result["missing"], 1)
        self.assertEqual(result["unsupported"], 1)
        self.assertEqual(result["incorrect"], 1)

    def test_ambiguous_values_excluded_and_extra_payments_penalized(self):
        self.gold["excluded_paths"] = ["policy.end_date"]
        self.prediction["policy"]["end_date"] = "wrong"
        self.prediction["payments"].append(dict(self.prediction["payments"][0]))
        result = score_prediction(self.prediction, self.gold)
        self.assertEqual(result["groups"]["dates"]["total"], 3)
        self.assertEqual(result["critical_date_errors"], 0)
        self.assertEqual(result["score"], 87.5)

    def test_empty_annotation_does_not_produce_perfect_score(self):
        self.assertEqual(score_prediction({}, {})["score"], 0)
