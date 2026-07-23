from __future__ import annotations

import logging
import time
from copy import deepcopy
from typing import Any

from apps.common.drive import (
    DriveError,
    build_drive_file_tree_map,
    download_drive_file,
    ensure_deal_folder,
)
from apps.policies.ai_service import PolicyRecognitionError, recognize_policy_from_text
from django.conf import settings

from .document_recognition import DocumentRecognitionError, recognize_document_from_file

logger = logging.getLogger(__name__)

OSAGO_TEMPLATE: dict[str, Any] = {
    "policyholder": {
        "full_name": "",
        "birth_date": "",
        "passport_series": "",
        "passport_number": "",
        "registration_address": "",
    },
    "drivers": [],
    "vehicle": {
        "vin": "",
        "brand": "",
        "model": "",
        "year": None,
        "plate_number": "",
        "sts_series": "",
        "sts_number": "",
    },
    "insurance": {
        "start_date": "",
        "region": "",
        "usage_purpose": "",
        "unlimited_drivers": False,
    },
}


class CalculationRecognitionFolderMissing(Exception):
    pass


DEFAULT_CALCULATION_RECOGNITION_BUDGET_SECONDS = 240


def recognize_osago_calculation(
    deal, file_ids: list[str], source_text: str
) -> dict[str, Any]:
    folder_id = deal.drive_folder_id
    if file_ids and not folder_id:
        folder_id = ensure_deal_folder(deal)
        if not folder_id:
            raise CalculationRecognitionFolderMissing(
                "Папка Google Drive для сделки не найдена."
            )

    data = deepcopy(OSAGO_TEMPLATE)
    warnings: list[str] = []
    candidates: dict[str, list[tuple[Any, float, str]]] = {}
    file_results: list[dict[str, Any]] = []
    used_files: list[dict[str, str]] = []
    budget_seconds = float(
        getattr(
            settings,
            "CALCULATION_RECOGNITION_BUDGET_SECONDS",
            DEFAULT_CALCULATION_RECOGNITION_BUDGET_SECONDS,
        )
    )
    deadline = time.monotonic() + max(budget_seconds, 1.0)

    file_map = build_drive_file_tree_map(folder_id) if file_ids else {}
    for file_id in file_ids:
        file_info = file_map.get(file_id)
        if not file_info or file_info.get("is_folder"):
            file_results.append(
                {
                    "fileId": file_id,
                    "status": "error",
                    "message": "Файл не найден в папке сделки.",
                }
            )
            warnings.append(f"Файл {file_id} не найден в папке сделки.")
            continue

        file_name = str(file_info.get("name") or file_id)
        file_started = time.monotonic()
        logger.info("Начало распознавания файла расчёта file_id=%s", file_id)
        if time.monotonic() >= deadline:
            message = "Превышен общий лимит времени распознавания сделки."
            file_results.append(
                {
                    "fileId": file_id,
                    "fileName": file_name,
                    "status": "error",
                    "message": message,
                }
            )
            warnings.append(f"{file_name}: {message}")
            logger.warning(
                "Пропуск файла расчёта из-за общего лимита file_id=%s elapsed=%.2f",
                file_id,
                time.monotonic() - file_started,
            )
            continue
        try:
            recognition = recognize_document_from_file(
                download_drive_file(file_id), file_name, deadline=deadline
            )
            confidence = float(recognition.confidence or 0.0)
            _add_document_candidates(
                candidates,
                recognition.normalized_type,
                recognition.data,
                confidence,
                file_name,
            )
            warnings.extend(str(item) for item in recognition.warnings)
            file_results.append(
                {
                    "fileId": file_id,
                    "fileName": file_name,
                    "status": "parsed",
                    "documentType": recognition.normalized_type,
                    "confidence": recognition.confidence,
                }
            )
            used_files.append({"id": file_id, "name": file_name})
            logger.info(
                "Файл расчёта распознан file_id=%s elapsed=%.2f",
                file_id,
                time.monotonic() - file_started,
            )
        except (DriveError, DocumentRecognitionError) as exc:
            logger.warning(
                "Ошибка распознавания файла расчёта file_id=%s elapsed=%.2f: %s",
                file_id,
                time.monotonic() - file_started,
                exc,
            )
            file_results.append(
                {
                    "fileId": file_id,
                    "fileName": file_name,
                    "status": "error",
                    "message": str(exc),
                }
            )
            warnings.append(f"{file_name}: {exc}")
        except Exception:
            logger.exception(
                "Непредвиденная ошибка распознавания файла file_id=%s elapsed=%.2f",
                file_id,
                time.monotonic() - file_started,
            )
            file_results.append(
                {
                    "fileId": file_id,
                    "fileName": file_name,
                    "status": "error",
                    "message": "Внутренняя ошибка распознавания документа.",
                }
            )
            warnings.append(f"{file_name}: внутренняя ошибка распознавания.")

    if source_text:
        try:
            text_payload, _ = recognize_policy_from_text(source_text)
            _add_text_candidates(candidates, text_payload, 0.8)
        except PolicyRecognitionError as exc:
            warnings.append(f"Текстовый источник: {exc}")
        except Exception:
            logger.exception("Ошибка распознавания текстового источника")
            warnings.append("Текстовый источник: внутренняя ошибка распознавания.")

    for path, values in candidates.items():
        if not values:
            continue
        if path == "drivers":
            data["drivers"] = [item[0] for item in values if item[0]]
            continue
        values.sort(key=lambda item: item[1], reverse=True)
        selected_value, _, selected_source = values[0]
        _set_path(data, path, selected_value)
        distinct = {str(item[0]) for item in values if item[0] not in (None, "")}
        if len(distinct) > 1:
            alternatives = ", ".join(sorted(distinct))
            warnings.append(
                f"Конфликт поля {path}: выбрано значение из {selected_source}; варианты: {alternatives}."
            )

    return {
        "calculationType": "osago",
        "data": data,
        "warnings": list(dict.fromkeys(warnings)),
        "confidence": _calculate_confidence(candidates),
        "sources": {
            "files": used_files,
            "textIncluded": bool(source_text),
        },
        "fileResults": file_results,
    }


def _add_document_candidates(
    candidates: dict[str, list[tuple[Any, float, str]]],
    document_type: str | None,
    fields: dict[str, Any],
    confidence: float,
    source: str,
) -> None:
    if document_type == "passport":
        mapping = {
            "full_name": "policyholder.full_name",
            "birth_date": "policyholder.birth_date",
            "series": "policyholder.passport_series",
            "number": "policyholder.passport_number",
            "registration_address": "policyholder.registration_address",
        }
    elif document_type == "driver_license":
        driver = {
            "full_name": fields.get("full_name", ""),
            "birth_date": fields.get("birth_date", ""),
            "license_series": fields.get("series", ""),
            "license_number": fields.get("number", ""),
            "license_issue_date": fields.get("issue_date", ""),
        }
        if any(value not in (None, "") for value in driver.values()):
            candidates.setdefault("drivers", []).append((driver, confidence, source))
        return
    elif document_type in {"sts", "epts"}:
        mapping = {
            "vin": "vehicle.vin",
            "vehicle_brand": "vehicle.brand",
            "vehicle_model": "vehicle.model",
            "year": "vehicle.year",
            "plate_number": "vehicle.plate_number",
            "sts_series": "vehicle.sts_series",
            "sts_number": "vehicle.sts_number",
            "owner": "policyholder.full_name",
        }
    else:
        mapping = {}

    for source_key, target_path in mapping.items():
        value = fields.get(source_key)
        if value not in (None, "", []):
            candidates.setdefault(target_path, []).append((value, confidence, source))


def _add_text_candidates(
    candidates: dict[str, list[tuple[Any, float, str]]],
    payload: dict[str, Any],
    confidence: float,
) -> None:
    mapping = {
        "client_name": "policyholder.full_name",
        "policy.start_date": "insurance.start_date",
        "policy.vehicle_brand": "vehicle.brand",
        "policy.vehicle_model": "vehicle.model",
        "policy.vehicle_vin": "vehicle.vin",
    }
    for source_path, target_path in mapping.items():
        value: Any = payload
        for part in source_path.split("."):
            value = value.get(part) if isinstance(value, dict) else None
        if value not in (None, "", []):
            candidates.setdefault(target_path, []).append(
                (value, confidence, "текстовый источник")
            )


def _set_path(data: dict[str, Any], path: str, value: Any) -> None:
    if path.startswith("drivers[]."):
        key = path.removeprefix("drivers[].")
        if not data["drivers"]:
            data["drivers"].append({})
        data["drivers"][0][key] = value
        return
    section, key = path.split(".", 1)
    data[section][key] = value


def _calculate_confidence(
    candidates: dict[str, list[tuple[Any, float, str]]],
) -> float | None:
    values = [items[0][1] for items in candidates.values() if items]
    return round(sum(values) / len(values), 4) if values else None
