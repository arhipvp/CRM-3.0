"""Regression tests for CI failures previously accepted by the quality gate."""

from __future__ import annotations

import io
import json
import os
import unittest
from contextlib import redirect_stdout
from unittest.mock import patch

from scripts.check_ci_quality_gate import REQUIRED_JOBS, main, quality_gate_errors


def successful_jobs(docker_relevant: str = "false") -> dict:
    needs = {name: {"result": "success"} for name in REQUIRED_JOBS}
    needs["docker-changes"]["outputs"] = {"docker_relevant": docker_relevant}
    needs["docker-build"] = {"result": "success"}
    return needs


class QualityGateTests(unittest.TestCase):
    def test_accepts_successful_jobs_for_push_and_pull_request(self):
        for event in ("push", "pull_request"):
            for relevant in ("true", "false"):
                with self.subTest(event=event, relevant=relevant):
                    self.assertEqual(
                        quality_gate_errors(successful_jobs(relevant), event), []
                    )

    def test_rejects_every_unsuccessful_required_job_even_without_docker_changes(self):
        for job_name in REQUIRED_JOBS:
            for result in ("failure", "cancelled", "skipped", None):
                with self.subTest(job=job_name, result=result):
                    needs = successful_jobs()
                    needs[job_name]["result"] = result
                    needs["docker-build"]["result"] = "skipped"

                    errors = quality_gate_errors(needs, "pull_request")

                    self.assertIn(f"Required job {job_name} did not succeed", errors)

    def test_rejects_missing_smoke_dependency(self):
        needs = successful_jobs()
        del needs["backend-tests-smoke"]

        self.assertIn(
            "Required job backend-tests-smoke did not succeed",
            quality_gate_errors(needs, "pull_request"),
        )

    def test_allows_docker_skip_only_for_pr_without_docker_changes(self):
        for event, relevant, allowed in (
            ("pull_request", "false", True),
            ("pull_request", "true", False),
            ("push", "false", False),
            ("push", "true", False),
        ):
            with self.subTest(event=event, relevant=relevant):
                needs = successful_jobs(relevant)
                needs["docker-build"]["result"] = "skipped"

                self.assertEqual(not quality_gate_errors(needs, event), allowed)

    def test_rejects_docker_failure_cancellation_and_missing_job_when_optional(self):
        for result in ("failure", "cancelled", None):
            with self.subTest(result=result):
                needs = successful_jobs()
                needs["docker-build"]["result"] = result
                self.assertTrue(quality_gate_errors(needs, "pull_request"))

        needs = successful_jobs()
        del needs["docker-build"]
        self.assertTrue(quality_gate_errors(needs, "pull_request"))

    def test_missing_or_unexpected_detector_output_does_not_allow_docker_skip(self):
        for outputs in (
            None,
            {},
            {"docker_relevant": "unknown"},
            {"docker_relevant": False},
        ):
            with self.subTest(outputs=outputs):
                needs = successful_jobs()
                needs["docker-changes"]["outputs"] = outputs
                needs["docker-build"]["result"] = "skipped"

                self.assertTrue(quality_gate_errors(needs, "pull_request"))

    def test_rejects_malformed_results_and_unsupported_event(self):
        for needs in (None, [], "success"):
            with self.subTest(needs=needs):
                self.assertTrue(quality_gate_errors(needs, "pull_request"))
        self.assertTrue(quality_gate_errors(successful_jobs(), "workflow_dispatch"))

    def test_cli_reads_github_needs_and_event_from_environment(self):
        with patch.dict(
            os.environ,
            {
                "CI_NEEDS_JSON": json.dumps(successful_jobs()),
                "CI_EVENT_NAME": "pull_request",
            },
        ), redirect_stdout(io.StringIO()) as output:
            self.assertEqual(main(), 0)

        self.assertIn("All quality checks passed!", output.getvalue())

    def test_cli_rejects_missing_or_invalid_json(self):
        for value in ("", "not JSON"):
            with self.subTest(value=value):
                with patch.dict(
                    os.environ,
                    {"CI_NEEDS_JSON": value, "CI_EVENT_NAME": "pull_request"},
                ), redirect_stdout(io.StringIO()):
                    self.assertEqual(main(), 1)


if __name__ == "__main__":
    unittest.main()
