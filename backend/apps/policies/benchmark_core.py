"""Offline benchmark accounting and scoring; never creates CRM business objects.

The ledger is deliberately fail-closed. A reserved call may have reached the
provider even when its process crashed. Reconcile that call before continuing;
never erase the reservation to retry it. Use one unique ID per paid attempt.
"""

import json
import os
import re
import tempfile
from contextlib import contextmanager
from datetime import date
from decimal import Decimal, InvalidOperation
from pathlib import Path

_SECRET_KEY = re.compile(
    r"authorization|api[_-]?key|access[_-]?token|refresh[_-]?token|password|secret",
    re.IGNORECASE,
)
_TOKEN = re.compile(r"\b(?:pza_|sk-)[A-Za-z0-9_-]{8,}|\bBearer\s+\S+", re.IGNORECASE)
_MISSING = object()


class BudgetError(RuntimeError):
    """A call cannot be admitted safely or needs manual reconciliation."""


class DuplicateRequest(BudgetError):
    """This paid attempt already exists; inspect its saved result instead."""


def sanitize(value, secrets=()):
    """Keep document contents, but redact credential fields and known tokens."""
    if isinstance(value, dict):
        return {
            str(key): (
                "[REDACTED]"
                if _SECRET_KEY.search(str(key))
                else sanitize(item, secrets)
            )
            for key, item in value.items()
        }
    if isinstance(value, (list, tuple)):
        return [sanitize(item, secrets) for item in value]
    if isinstance(value, str):
        for secret in sorted(filter(None, secrets), key=len, reverse=True):
            value = value.replace(secret, "[REDACTED]")
        return _TOKEN.sub("[REDACTED]", value)
    return value


def _money(value):
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise BudgetError("Cost must be a known nonnegative RUB amount") from exc
    if not amount.is_finite() or amount < 0:
        raise BudgetError("Cost must be a known nonnegative RUB amount")
    return amount


class BudgetLedger:
    """Atomic private JSON ledger; an exclusive sidecar protects each mutation.

    A leftover lock after a crash also fails closed. Remove it only after
    verifying that no benchmark process is still running. Limits persisted at
    creation cannot be silently changed when reopening a run.
    """

    def __init__(self, path, working_limit="270", hard_limit="300", secrets=()):
        self.path = Path(path)
        self.working_limit = _money(working_limit)
        self.hard_limit = _money(hard_limit)
        self.secrets = tuple(secrets)
        if not 0 < self.working_limit <= self.hard_limit <= Decimal("300"):
            raise BudgetError("Require 0 < working limit <= hard limit <= 300 RUB")

    def _load(self):
        if not self.path.exists():
            return {
                "version": 1,
                "working_limit": str(self.working_limit),
                "hard_limit": str(self.hard_limit),
                "requests": {},
            }
        try:
            state = json.loads(self.path.read_text(encoding="utf-8"))
            if (
                state["version"] != 1
                or _money(state["working_limit"]) != self.working_limit
                or _money(state["hard_limit"]) != self.hard_limit
                or not isinstance(state["requests"], dict)
            ):
                raise ValueError("Unexpected ledger format or limits")
            for record in state["requests"].values():
                _money(record["upper_bound"])
                if record["state"] not in {"reserved", "unknown", "settled"}:
                    raise ValueError("Unexpected request state")
                if record["state"] == "settled":
                    _money(record["actual_cost"])
            return state
        except (OSError, ValueError, KeyError, TypeError) as exc:
            raise BudgetError("Cannot safely read the benchmark ledger") from exc

    @contextmanager
    def _locked(self):
        self.path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        lock_path = self.path.with_suffix(self.path.suffix + ".lock")
        try:
            descriptor = os.open(lock_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        except FileExistsError as exc:
            raise BudgetError("Ledger locked; inspect the running process") from exc
        try:
            os.close(descriptor)
            yield
        finally:
            lock_path.unlink()

    def _save(self, state):
        descriptor, temporary = tempfile.mkstemp(
            prefix=self.path.name + ".", dir=self.path.parent
        )
        try:
            with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
                json.dump(sanitize(state, self.secrets), handle, ensure_ascii=False)
                handle.flush()
                os.fsync(handle.fileno())
            os.chmod(temporary, 0o600)
            os.replace(temporary, self.path)
            if os.name != "nt":
                directory = os.open(self.path.parent, os.O_RDONLY | os.O_DIRECTORY)
                try:
                    os.fsync(directory)
                finally:
                    os.close(directory)
        finally:
            if os.path.exists(temporary):
                os.unlink(temporary)

    @staticmethod
    def _summary(state):
        records = state["requests"].values()
        spent = sum(
            (
                _money(record["actual_cost"])
                for record in records
                if record["state"] == "settled"
            ),
            Decimal("0"),
        )
        unresolved = [
            key
            for key, record in state["requests"].items()
            if record["state"] != "settled"
        ]
        reserved = sum(
            (_money(state["requests"][key]["upper_bound"]) for key in unresolved),
            Decimal("0"),
        )
        return {
            "spent": spent,
            "reserved": reserved,
            "unresolved": unresolved,
            "remaining": max(
                Decimal("0"), _money(state["working_limit"]) - spent - reserved
            ),
            "overrun": any(
                record.get("overrun", False) for record in state["requests"].values()
            ),
        }

    def summary(self):
        return self._summary(self._load())

    def get(self, request_id):
        return self._load()["requests"].get(request_id)

    def reserve(self, request_id, upper_bound, metadata=None):
        upper_bound = _money(upper_bound)
        if not isinstance(request_id, str) or not request_id or upper_bound <= 0:
            raise BudgetError("Require a nonempty request ID and positive upper bound")
        if sanitize(request_id, self.secrets) != request_id:
            raise BudgetError("Request IDs must not contain credentials")
        with self._locked():
            state = self._load()
            if request_id in state["requests"]:
                raise DuplicateRequest("Attempt already recorded; do not send it again")
            summary = self._summary(state)
            if summary["unresolved"] or summary["overrun"]:
                raise BudgetError("Reconcile unknown charges or an estimate overrun")
            if summary["spent"] + upper_bound > self.working_limit:
                raise BudgetError("Call upper bound exceeds remaining working budget")
            record = {
                "state": "reserved",
                "upper_bound": str(upper_bound),
                "actual_cost": None,
                "metadata": metadata or {},
            }
            state["requests"][request_id] = record
            self._save(state)
            return sanitize(record, self.secrets)

    def settle(self, request_id, actual_cost, outcome="success", result=None):
        """Record verified charge, including errors; None marks charge unknown.

        Store the response together with settlement so a restart can retrieve
        it without paying again. Charges above the reservation are saved but
        halt the run, even when they are below the nominal working limit.
        """
        cost = None if actual_cost is None else _money(actual_cost)
        with self._locked():
            state = self._load()
            if request_id not in state["requests"]:
                raise BudgetError("Attempt was not reserved")
            record = state["requests"][request_id]
            if record["state"] == "settled":
                raise DuplicateRequest("Charge already settled")
            record.update(
                state="unknown" if cost is None else "settled",
                actual_cost=None if cost is None else str(cost),
                outcome=outcome,
                result=record.get("result") if result is None else result,
                overrun=cost is not None and cost > _money(record["upper_bound"]),
            )
            self._save(state)
            if record["overrun"]:
                raise BudgetError("Actual charge exceeds reservation; run halted")
            return sanitize(record, self.secrets)


def should_retry(attempt, status_code=None, network_error=False):
    """Zero-based attempt index; at most one controlled transient-error retry."""
    return attempt == 0 and (
        network_error
        or status_code == 429
        or (isinstance(status_code, int) and 500 <= status_code <= 599)
    )


def _lookup(payload, path):
    current = payload
    for part in path.split("."):
        if isinstance(current, list):
            if part == "length":
                current = len(current)
            elif part.isdigit() and int(part) < len(current):
                current = current[int(part)]
            else:
                return _MISSING
        elif isinstance(current, dict):
            current = current.get(part, _MISSING)
        else:
            return _MISSING
    return current


def _empty(value):
    return value is _MISSING or value is None or value == ""


def _matches(actual, expected, category):
    if _empty(expected):
        return _empty(actual)
    if _empty(actual):
        return False
    if category == "dates":
        if not isinstance(actual, str) or not isinstance(expected, str):
            return False
        try:
            return (
                date.fromisoformat(actual).isoformat() == actual
                and date.fromisoformat(expected).isoformat() == expected
                and actual == expected
            )
        except ValueError:
            return False
    if category == "money":
        try:
            return _money(actual) == _money(expected)
        except BudgetError:
            return False
    if isinstance(actual, str) and isinstance(expected, str):
        return (
            " ".join(actual.split()).casefold() == " ".join(expected.split()).casefold()
        )
    return type(actual) is type(expected) and actual == expected


def score_prediction(prediction, gold, valid=True):
    """Score manually annotated dotted paths without revealing field values.

    Missing groups are excluded and remaining weights renormalized. Annotate
    payments.length to penalize omitted/extra rows; annotate empty fields when
    their absence is verified. Unknown/ambiguous paths belong in excluded_paths.
    A mismatch is not automatically labelled hallucination: only a value in a
    confirmed-empty field is reported as unsupported.
    """
    valid = bool(valid and isinstance(prediction, dict))
    weights = {"dates": 50, "money": 25, "other": 25}
    excluded = set(gold.get("excluded_paths", []))
    fields = []
    groups = {}
    weighted = 0.0
    total_weight = 0
    for category, weight in weights.items():
        expected_fields = gold.get(category, {})
        assessed = {
            path: expected
            for path, expected in expected_fields.items()
            if path not in excluded
        }
        correct = 0
        for path, expected in assessed.items():
            actual = _lookup(prediction, path) if valid else _MISSING
            matches = valid and _matches(actual, expected, category)
            correct += int(matches)
            if matches:
                status = "correct"
            elif _empty(actual):
                status = "missing"
            elif _empty(expected):
                status = "unsupported"
            else:
                status = "incorrect"
            fields.append({"path": path, "category": category, "status": status})
        count = len(assessed)
        groups[category] = {"correct": correct, "total": count}
        if count:
            weighted += weight * correct / count
            total_weight += weight
    critical = set(gold.get("critical_date_paths", []))
    start = _lookup(prediction, "policy.start_date") if valid else _MISSING
    first = _lookup(prediction, "payments.0.payment_date") if valid else _MISSING
    invariant = (
        None if _empty(start) or _empty(first) else _matches(first, start, "dates")
    )
    return {
        "valid": bool(valid),
        "score": round(100 * weighted / total_weight, 4) if total_weight else 0.0,
        "groups": groups,
        "fields": fields,
        "critical_date_errors": sum(
            field["path"] in critical and field["status"] != "correct"
            for field in fields
        ),
        "first_payment_matches_start": invariant,
        "missing": sum(field["status"] == "missing" for field in fields),
        "unsupported": sum(field["status"] == "unsupported" for field in fields),
        "incorrect": sum(field["status"] == "incorrect" for field in fields),
    }
