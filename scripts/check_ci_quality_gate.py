"""Validate required CI job results, including conditional Docker builds."""

from __future__ import annotations

import json
import os

REQUIRED_JOBS = (
    "docker-changes",
    "secret-scan",
    "backend-lint",
    "backend-tests-smoke",
    "backend-tests-core",
    "backend-tests-domain",
    "backend-tests-finance",
    "backend-coverage-merge",
    "frontend-quality",
    "frontend-tests",
    "frontend-build",
)


def quality_gate_errors(needs: object, event_name: str) -> list[str]:
    """Fail closed when a required job is absent or did not succeed."""
    if not isinstance(needs, dict):
        return ["CI job results must be a JSON object"]

    errors = []
    if event_name not in {"push", "pull_request"}:
        errors.append("Unsupported CI event")

    for job_name in REQUIRED_JOBS:
        job = needs.get(job_name)
        result = job.get("result") if isinstance(job, dict) else None
        if result != "success":
            errors.append(f"Required job {job_name} did not succeed")

    detector = needs.get("docker-changes")
    outputs = detector.get("outputs") if isinstance(detector, dict) else None
    docker_may_skip = (
        event_name == "pull_request"
        and isinstance(detector, dict)
        and detector.get("result") == "success"
        and isinstance(outputs, dict)
        and outputs.get("docker_relevant") == "false"
    )
    docker = needs.get("docker-build")
    docker_result = docker.get("result") if isinstance(docker, dict) else None
    if docker_result != "success" and not (
        docker_may_skip and docker_result == "skipped"
    ):
        errors.append("Docker build did not succeed or was skipped unexpectedly")

    return errors


def main() -> int:
    try:
        needs = json.loads(os.environ.get("CI_NEEDS_JSON", ""))
    except json.JSONDecodeError:
        print("Invalid or missing CI_NEEDS_JSON")
        return 1

    errors = quality_gate_errors(needs, os.environ.get("CI_EVENT_NAME", ""))
    for error in errors:
        print(error)
    if errors:
        return 1

    print("All quality checks passed!")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
