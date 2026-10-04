import logging
from typing import List

from apps.common.ai_diagnostics import log_ai_diagnostic
from apps.common.drive import (
    DriveError,
    build_drive_file_tree_map,
    download_drive_file,
    ensure_deal_folder,
)
from apps.deals.models import Bank, InsuranceCompany, InsuranceType

from ..ai_service import (
    PolicyRecognitionError,
    extract_text_from_bytes,
    is_image_filename,
    is_pdf_filename,
    is_policy_image_filename,
    policy_file_requires_vision,
    policy_vision_fallback_enabled,
    recognize_policy_from_pdf_images,
    recognize_policy_from_text,
)

logger = logging.getLogger(__name__)


class PolicyRecognitionFolderMissing(Exception):
    pass


def recognize_policy_files(deal, file_ids: list[str]) -> dict:
    folder_id = deal.drive_folder_id
    if not folder_id:
        try:
            folder_id = ensure_deal_folder(deal)
        except DriveError as exc:
            logger.warning("Failed to ensure drive folder: %s", exc)
            raise
    if not folder_id:
        raise PolicyRecognitionFolderMissing("Файловая папка сделки не настроена.")

    try:
        file_map = build_drive_file_tree_map(folder_id)
    except DriveError:
        logger.exception("Cannot list drive files")
        raise

    seen = set()
    results: List[dict] = []
    company_names = list(
        InsuranceCompany.objects.filter(name__isnull=False)
        .exclude(name__exact="")
        .order_by("name")
        .values("name", "description")
        .distinct()
    )
    type_names = list(
        InsuranceType.objects.filter(name__isnull=False)
        .exclude(name__exact="")
        .order_by("name")
        .values("name", "description")
        .distinct()
    )
    bank_names = list(
        Bank.objects.filter(name__isnull=False)
        .exclude(name__exact="")
        .order_by("name")
        .values("name", "description")
        .distinct()
    )

    downloaded_files: List[dict[str, object]] = []
    for file_id in file_ids:
        if file_id in seen:
            continue
        seen.add(file_id)

        file_info = file_map.get(file_id)
        if not file_info:
            results.append(
                {
                    "fileId": file_id,
                    "status": "error",
                    "message": "Файл не найден в папке сделки.",
                    "error": {
                        "code": "file_not_found",
                        "message": "Файл не найден в папке сделки.",
                        "retryable": False,
                    },
                }
            )
            continue

        try:
            content = download_drive_file(file_id)
        except DriveError as exc:
            results.append(
                {
                    "fileId": file_id,
                    "fileName": file_info["name"],
                    "status": "error",
                    "message": str(exc),
                    "error": {
                        "code": "drive_error",
                        "message": str(exc),
                        "retryable": True,
                    },
                }
            )
            continue

        if is_image_filename(file_info["name"]) and not is_policy_image_filename(
            file_info["name"]
        ):
            results.append(
                {
                    "fileId": file_id,
                    "fileName": file_info["name"],
                    "status": "error",
                    "message": (
                        "Неподдерживаемый формат изображения для распознавания "
                        "полиса. Поддерживаются JPG, JPEG и PNG."
                    ),
                    "error": {
                        "code": "unsupported_file_type",
                        "message": "Неподдерживаемый формат изображения для распознавания полиса. Поддерживаются JPG, JPEG и PNG.",
                        "retryable": False,
                    },
                }
            )
            continue

        extracted_text = ""
        if not is_policy_image_filename(file_info["name"]):
            try:
                extracted_text = extract_text_from_bytes(content, file_info["name"])
            except PolicyRecognitionError as exc:
                if not (
                    policy_vision_fallback_enabled()
                    and is_pdf_filename(file_info["name"])
                ):
                    results.append(
                        {
                            "fileId": file_id,
                            "fileName": file_info["name"],
                            "status": "error",
                            "message": str(exc),
                            "error": _recognition_error_payload(exc),
                        }
                    )
                    continue

        downloaded_files.append(
            {
                "id": file_id,
                "name": file_info["name"],
                "text": extracted_text,
                "content": content,
            }
        )

    if downloaded_files:
        _append_recognition_results(
            results,
            downloaded_files,
            company_names=company_names,
            type_names=type_names,
            bank_names=bank_names,
        )

    return {"results": results}


def _append_recognition_results(
    results: list[dict],
    downloaded_files: list[dict[str, object]],
    *,
    company_names: list[dict],
    type_names: list[dict],
    bank_names: list[dict],
) -> None:
    combined_text = "\n\n".join(
        f"Файл {file_data['name']}:\n{file_data['text']}"
        for file_data in downloaded_files
    ).strip()
    if not combined_text:
        combined_text = downloaded_files[0]["text"]

    needs_vision = any(
        policy_file_requires_vision(
            str(file_data["name"]), str(file_data.get("text") or "")
        )
        for file_data in downloaded_files
    )
    has_text = any(
        str(file_data.get("text") or "").strip() for file_data in downloaded_files
    )
    log_ai_diagnostic(
        "policy.batch_mode_selected",
        files=downloaded_files,
        combined_text=combined_text,
        can_use_vision=policy_vision_fallback_enabled() and needs_vision,
        text_is_poor=needs_vision,
        mode=(
            "mixed"
            if needs_vision and has_text
            else "vision" if needs_vision else "text"
        ),
    )
    used_vision = False
    try:
        if needs_vision:
            if not policy_vision_fallback_enabled():
                raise PolicyRecognitionError(
                    "Vision-распознавание полисов отключено в настройках."
                )
            data, _ = recognize_policy_from_pdf_images(
                downloaded_files,
                extra_companies=company_names,
                extra_types=type_names,
                extra_banks=bank_names,
            )
            used_vision = True
        else:
            data, _ = recognize_policy_from_text(
                str(combined_text),
                extra_companies=company_names,
                extra_types=type_names,
                extra_banks=bank_names,
            )
    except PolicyRecognitionError as exc:
        _append_recognition_error_results(
            results,
            downloaded_files,
            message=str(exc),
            error=exc,
        )
        return

    primary_file_id = downloaded_files[0]["id"]
    for file_data in downloaded_files:
        is_primary = file_data["id"] == primary_file_id
        if is_primary and used_vision and has_text:
            message = (
                "Распознано по тексту и изображениям "
                f"(1 запрос на {len(downloaded_files)} файлов)."
            )
        elif is_primary and used_vision:
            message = (
                "Распознано через Vision ИИ "
                f"(1 запрос на {len(downloaded_files)} файлов)."
            )
        elif is_primary:
            message = f"Распознано (1 запрос на {len(downloaded_files)} файлов)."
        else:
            message = (
                "Файл использован в общем распознавании, результат см. "
                "в первом файле."
            )
        payload = {
            "fileId": file_data["id"],
            "fileName": file_data["name"],
            "status": "parsed",
            "message": message,
        }
        if is_primary:
            payload["data"] = data
        results.append(payload)


def _append_recognition_error_results(
    results: list[dict],
    downloaded_files: list[dict[str, object]],
    *,
    message: str,
    error: Exception | None = None,
) -> None:
    for file_data in downloaded_files:
        results.append(
            {
                "fileId": file_data["id"],
                "fileName": file_data["name"],
                "status": "error",
                "message": message,
                "error": (
                    _recognition_error_payload(error)
                    if error
                    else {
                        "code": "recognition_error",
                        "message": message,
                        "retryable": False,
                    }
                ),
            }
        )


def _recognition_error_payload(exc: Exception) -> dict:
    return {
        "code": getattr(exc, "code", "recognition_error"),
        "message": str(exc),
        "retryable": bool(getattr(exc, "retryable", False)),
    }
