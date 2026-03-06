import json
import logging
import os
import subprocess
import threading
import time
import uuid
from datetime import date, datetime
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from .models import Policy, PolicyIssuanceExecution

logger = logging.getLogger(__name__)


class PolicyIssuanceError(Exception):
    pass


@dataclass(frozen=True)
class IssuancePaths:
    root_dir: Path
    payload_file: Path
    control_file: Path
    result_file: Path
    screenshot_dir: Path


@dataclass
class RunnerHandle:
    process: subprocess.Popen
    monitor_thread: threading.Thread
    paths: IssuancePaths


_RUNNERS: dict[str, RunnerHandle] = {}
_RUNNERS_LOCK = threading.Lock()


def get_latest_execution(policy: Policy) -> PolicyIssuanceExecution | None:
    prefetched = getattr(policy, "prefetched_issuance_executions", None)
    if prefetched is not None:
        return prefetched[0] if prefetched else None
    return policy.issuance_executions.order_by("-created_at").first()


def _to_iso_date(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return str(value).strip()


def build_policy_issuance_payload(policy: Policy) -> dict[str, Any]:
    missing_fields: list[str] = []
    client_name = (getattr(policy.client, "name", "") or "").strip()
    if not client_name:
        missing_fields.append("client")
    if not policy.is_vehicle:
        missing_fields.append("is_vehicle")
    if not (policy.brand or "").strip():
        missing_fields.append("brand")
    if not (policy.model or "").strip():
        missing_fields.append("model")
    if not (policy.vin or "").strip():
        missing_fields.append("vin")
    if not policy.start_date:
        missing_fields.append("start_date")
    if not policy.end_date:
        missing_fields.append("end_date")
    insurance_type_name = (getattr(policy.insurance_type, "name", "") or "").strip()
    if not insurance_type_name:
        missing_fields.append("insurance_type")
    elif (
        "осаго" not in insurance_type_name.lower()
        and "osago" not in insurance_type_name.lower()
    ):
        missing_fields.append("insurance_type_osago")

    matching_quote = (
        policy.deal.quotes.filter(
            insurance_company=policy.insurance_company,
            insurance_type=policy.insurance_type,
            deleted_at__isnull=True,
        )
        .order_by("-created_at")
        .first()
    )

    if missing_fields:
        raise ValidationError(
            {
                "detail": "Недостаточно данных для запуска оформления.",
                "missing_fields": missing_fields,
            }
        )

    return {
        "policyId": str(policy.id),
        "dealId": str(policy.deal_id),
        "product": PolicyIssuanceExecution.Product.OSAGO_AUTO,
        "provider": PolicyIssuanceExecution.Provider.SBER,
        "clientName": client_name,
        "counterparty": (policy.counterparty or "").strip(),
        "brand": (policy.brand or "").strip(),
        "model": (policy.model or "").strip(),
        "vin": (policy.vin or "").strip(),
        "startDate": _to_iso_date(policy.start_date),
        "endDate": _to_iso_date(policy.end_date),
        "insuranceCompany": getattr(policy.insurance_company, "name", "") or "",
        "insuranceType": insurance_type_name,
        "premium": str(matching_quote.premium) if matching_quote else "",
        "sumInsured": str(matching_quote.sum_insured) if matching_quote else "",
        "officialDealer": bool(getattr(matching_quote, "official_dealer", False)),
        "gap": bool(getattr(matching_quote, "gap", False)),
    }


def _workspace_root() -> Path:
    root = Path(getattr(settings, "SBER_ISSUANCE_WORKDIR", ""))
    if not root:
        root = Path(settings.MEDIA_ROOT) / "sber_issuance"
    root.mkdir(parents=True, exist_ok=True)
    return root


def get_execution_paths(execution_id: str) -> IssuancePaths:
    root_dir = _workspace_root() / execution_id
    root_dir.mkdir(parents=True, exist_ok=True)
    screenshot_dir = root_dir / "screenshots"
    screenshot_dir.mkdir(parents=True, exist_ok=True)
    return IssuancePaths(
        root_dir=root_dir,
        payload_file=root_dir / "payload.json",
        control_file=root_dir / "control.json",
        result_file=root_dir / "result.json",
        screenshot_dir=screenshot_dir,
    )


def _write_json(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def _read_json(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def _runner_env(paths: IssuancePaths) -> dict[str, str]:
    env = os.environ.copy()
    env["SBER_ISSUANCE_BASE_URL"] = getattr(settings, "SBER_ISSUANCE_BASE_URL", "")
    env["SBER_ISSUANCE_LOGIN"] = getattr(settings, "SBER_ISSUANCE_LOGIN", "")
    env["SBER_ISSUANCE_PASSWORD"] = getattr(settings, "SBER_ISSUANCE_PASSWORD", "")
    env["SBER_ISSUANCE_PROFILE_DIR"] = getattr(
        settings, "SBER_ISSUANCE_PROFILE_DIR", ""
    )
    env["SBER_ISSUANCE_HEADLESS"] = (
        "true" if getattr(settings, "SBER_ISSUANCE_HEADLESS", False) else "false"
    )
    env["SBER_ISSUANCE_MANUAL_TIMEOUT_SECONDS"] = str(
        getattr(settings, "SBER_ISSUANCE_MANUAL_TIMEOUT_SECONDS", 900)
    )
    env["SBER_ISSUANCE_SCREENSHOT_DIR"] = str(paths.screenshot_dir)
    return env


def _runner_command(execution_id: str, paths: IssuancePaths) -> list[str]:
    return [
        "node",
        str(Path(settings.BASE_DIR).parent / "tools" / "sber_issuance" / "runner.js"),
        "--execution-id",
        execution_id,
        "--payload",
        str(paths.payload_file),
        "--control",
        str(paths.control_file),
        "--result",
        str(paths.result_file),
    ]


def _sync_execution_from_result(execution_id: str, paths: IssuancePaths) -> None:
    payload = _read_json(paths.result_file)
    if payload is None:
        return

    execution = (
        PolicyIssuanceExecution.objects.select_related("policy")
        .filter(pk=execution_id)
        .first()
    )
    if execution is None:
        return

    log_items = payload.get("log")
    if isinstance(log_items, list):
        execution.log = log_items
    execution.status = payload.get("status") or execution.status
    execution.step = payload.get("step") or execution.step
    execution.manual_step_reason = payload.get("manual_step_reason") or ""
    execution.manual_step_instructions = payload.get("manual_step_instructions") or ""
    execution.external_policy_number = payload.get("external_policy_number") or ""
    execution.last_error = payload.get("last_error") or ""
    runtime_state = payload.get("runtime_state")
    if isinstance(runtime_state, dict):
        execution.runtime_state = runtime_state
    started_at = payload.get("started_at")
    finished_at = payload.get("finished_at")
    if started_at:
        parsed = parse_datetime(started_at)
        if parsed is not None:
            execution.started_at = parsed
    if finished_at:
        parsed = parse_datetime(finished_at)
        if parsed is not None:
            execution.finished_at = parsed
    execution.save(
        update_fields=[
            "status",
            "step",
            "manual_step_reason",
            "manual_step_instructions",
            "external_policy_number",
            "last_error",
            "runtime_state",
            "log",
            "started_at",
            "finished_at",
            "updated_at",
        ]
    )
    if (
        execution.status == PolicyIssuanceExecution.Status.SUCCEEDED
        and execution.external_policy_number
    ):
        policy = execution.policy
        if policy.number != execution.external_policy_number:
            policy.number = execution.external_policy_number
            policy.save(update_fields=["number", "updated_at"])


def _monitor_runner(
    execution_id: str, process: subprocess.Popen, paths: IssuancePaths
) -> None:
    try:
        last_mtime = None
        while True:
            if paths.result_file.exists():
                current_mtime = paths.result_file.stat().st_mtime
                if current_mtime != last_mtime:
                    _sync_execution_from_result(execution_id, paths)
                    last_mtime = current_mtime
            if process.poll() is not None:
                break
            time.sleep(1)
        _sync_execution_from_result(execution_id, paths)
        if process.returncode not in (0, None):
            execution = PolicyIssuanceExecution.objects.filter(pk=execution_id).first()
            if execution and execution.status not in (
                PolicyIssuanceExecution.Status.SUCCEEDED,
                PolicyIssuanceExecution.Status.CANCELED,
            ):
                execution.status = PolicyIssuanceExecution.Status.FAILED
                execution.last_error = (
                    execution.last_error or "Runner завершился с ошибкой."
                )
                execution.finished_at = timezone.now()
                execution.append_log(
                    "Runner завершился с ошибкой.",
                    step=execution.step,
                    level="error",
                )
                execution.save(
                    update_fields=[
                        "status",
                        "last_error",
                        "finished_at",
                        "log",
                        "updated_at",
                    ]
                )
    finally:
        with _RUNNERS_LOCK:
            _RUNNERS.pop(execution_id, None)


def _start_runner(execution: PolicyIssuanceExecution) -> None:
    paths = get_execution_paths(str(execution.id))
    _write_json(paths.payload_file, execution.payload)
    _write_json(
        paths.control_file,
        {
            "command": "run",
            "resume_token": execution.resume_token,
            "updated_at": timezone.now().isoformat(),
        },
    )
    command = _runner_command(str(execution.id), paths)
    process = subprocess.Popen(
        command,
        cwd=str(Path(settings.BASE_DIR).parent),
        env=_runner_env(paths),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    monitor_thread = threading.Thread(
        target=_monitor_runner,
        args=(str(execution.id), process, paths),
        daemon=True,
        name=f"sber-issuance-{execution.id}",
    )
    with _RUNNERS_LOCK:
        _RUNNERS[str(execution.id)] = RunnerHandle(
            process=process, monitor_thread=monitor_thread, paths=paths
        )
    monitor_thread.start()


@transaction.atomic
def start_policy_issuance(policy: Policy, requested_by) -> PolicyIssuanceExecution:
    active = (
        PolicyIssuanceExecution.objects.select_for_update()
        .filter(policy=policy, status__in=PolicyIssuanceExecution.active_statuses())
        .first()
    )
    if active is not None:
        raise ValidationError({"detail": "Для полиса уже есть активное оформление."})

    payload = build_policy_issuance_payload(policy)
    execution = PolicyIssuanceExecution.objects.create(
        policy=policy,
        requested_by=requested_by,
        provider=PolicyIssuanceExecution.Provider.SBER,
        product=PolicyIssuanceExecution.Product.OSAGO_AUTO,
        status=PolicyIssuanceExecution.Status.QUEUED,
        step="queued",
        payload=payload,
        resume_token=uuid_hex(),
        started_at=timezone.now(),
    )
    execution.append_log("Запуск оформления поставлен в очередь.", step="queued")
    execution.save(update_fields=["log", "updated_at"])
    try:
        _start_runner(execution)
    except OSError as exc:
        execution.status = PolicyIssuanceExecution.Status.FAILED
        execution.last_error = f"Не удалось запустить runner: {exc}"
        execution.finished_at = timezone.now()
        execution.append_log(execution.last_error, step="startup", level="error")
        execution.save(
            update_fields=["status", "last_error", "finished_at", "log", "updated_at"]
        )
        raise PolicyIssuanceError(execution.last_error) from exc
    return execution


def resume_policy_issuance(
    execution: PolicyIssuanceExecution,
) -> PolicyIssuanceExecution:
    if execution.status != PolicyIssuanceExecution.Status.WAITING_MANUAL:
        raise ValidationError(
            {"detail": "Resume доступен только из состояния waiting_manual."}
        )
    paths = get_execution_paths(str(execution.id))
    _write_json(
        paths.control_file,
        {
            "command": "resume",
            "resume_token": execution.resume_token,
            "updated_at": timezone.now().isoformat(),
        },
    )
    execution.append_log("Оператор подтвердил продолжение.", step=execution.step)
    execution.save(update_fields=["log", "updated_at"])
    return execution


def cancel_policy_issuance(
    execution: PolicyIssuanceExecution,
) -> PolicyIssuanceExecution:
    if execution.status not in PolicyIssuanceExecution.active_statuses():
        raise ValidationError({"detail": "Активного оформления для отмены нет."})
    paths = get_execution_paths(str(execution.id))
    _write_json(
        paths.control_file,
        {
            "command": "cancel",
            "resume_token": execution.resume_token,
            "updated_at": timezone.now().isoformat(),
        },
    )
    execution.status = PolicyIssuanceExecution.Status.CANCELED
    execution.finished_at = timezone.now()
    execution.append_log("Оформление отменено пользователем.", step=execution.step)
    execution.save(update_fields=["status", "finished_at", "log", "updated_at"])
    with _RUNNERS_LOCK:
        handle = _RUNNERS.get(str(execution.id))
    if handle is not None and handle.process.poll() is None:
        try:
            handle.process.terminate()
        except OSError:
            logger.exception("Failed to terminate issuance runner %s", execution.id)
    return execution


def uuid_hex() -> str:
    return uuid.uuid4().hex
