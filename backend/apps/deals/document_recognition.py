from __future__ import annotations

import base64
import json
import logging
import re
import time
from dataclasses import dataclass
from datetime import date
from io import BytesIO
from typing import Any

import openai
import pymupdf
from django.conf import settings
from PIL import Image, ImageOps

logger = logging.getLogger(__name__)


class DocumentRecognitionError(ValueError):
    """Ошибка распознавания документа."""


@dataclass
class RecognitionPayload:
    document_type: str
    normalized_type: str | None
    confidence: float | None
    warnings: list[str]
    data: dict[str, Any]
    accepted_fields: list[str]
    rejected_fields: dict[str, str]
    extracted_text: str
    transcript: str


DOCUMENT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "document_type": {
            "type": "string",
        },
        "confidence": {"anyOf": [{"type": "number"}, {"type": "null"}]},
        "warnings": {"type": "array", "items": {"type": "string"}},
        "data": {"type": "object", "additionalProperties": True},
        "extracted_text": {"type": "string"},
    },
    "required": ["document_type", "confidence", "warnings", "data", "extracted_text"],
    "additionalProperties": False,
}

DOCUMENT_FUNCTION: dict[str, Any] = {
    "name": "extract_document_data",
    "description": "Извлечение данных документа (паспорт/ВУ/эПТС) в JSON",
    "parameters": DOCUMENT_SCHEMA,
}

DOCUMENT_PROMPT = """Ты извлекаешь данные из российских документов.
Требуется вернуть только валидный JSON по схеме:
{
  "document_type": "тип документа свободным текстом (например: passport, driver_license, epts, sts, СТС, Паспорт РФ и т.д.)",
  "confidence": 0.0..1.0 или null,
  "warnings": ["..."],
  "data": {...},
  "extracted_text": "распознанный текст документа"
}

Правила:
1) Всегда пытайся определить тип документа и записать его в document_type понятным текстом.
2) Если тип определить нельзя, верни "unknown".
3) Предпочтительные каноничные значения, если уверен:
- passport
- driver_license
- epts
- sts
2) Никаких выдумок. Если поле не найдено или ты сомневаешься — оставь пустую строку или null.
3) Для каждого типа используй расширенный набор полей:
- passport: full_name, birth_date, birth_place, series, number, issue_date, issuer, issuer_code, registration_address, gender
- driver_license: full_name, birth_date, series, number, issue_date, expiry_date, issuer, categories
- epts: epts_number, status, issue_date, vin, vehicle_brand, vehicle_model, vehicle_type, year, body_number, chassis_number, engine_number, color, power_hp, eco_class, gross_weight, curb_weight, owner
- sts: sts_series, sts_number, issue_date, issued_by, plate_number, vin, vehicle_brand, vehicle_model, vehicle_type, year, color, engine_power_hp, max_weight, unladen_weight, owner
4) Даты приводи к YYYY-MM-DD, если возможно.
5) VIN возвращай в верхнем регистре.
6) Не путай epts и sts:
- если это карточка/бланк свидетельства о регистрации ТС (двусторонний документ с серией/номером СТС) — это sts;
- epts выбирай только когда явно указано, что это электронный ПТС.
7) Поле extracted_text обязательно: верни максимально полный читабельный текст с документа, который удалось распознать.
8) Если extracted_text непустой, data не должен быть пустым: заполни максимум полей, которые можно достоверно извлечь.
"""

DATE_DDMMYYYY_RE = re.compile(r"^(\d{2})[./-](\d{2})[./-](\d{4})$")
DATE_YYYYMMDD_RE = re.compile(r"^(\d{4})-(\d{2})-(\d{2})$")
DATE_ANY_RE = re.compile(r"\b(\d{2})[./-](\d{2})[./-](\d{4})\b")
PASSPORT_SERIES_NUMBER_RE = re.compile(r"\b(\d{2})\s?(\d{2})\s?(\d{6})\b")
ISSUER_CODE_RE = re.compile(r"\b(\d{3}-\d{3})\b")
VIN_RE = re.compile(r"^[A-HJ-NPR-Z0-9]{17}$")
PASSPORT_SERIES_RE = re.compile(r"^\d{4}$")
PASSPORT_NUMBER_RE = re.compile(r"^\d{6}$")
DL_SERIES_RE = re.compile(r"^[A-ZА-ЯЁ0-9]{4,10}$")
DL_NUMBER_RE = re.compile(r"^\d{5,10}$")
STS_SERIES_RE = re.compile(r"^\d{2}[А-ЯЁA-Z]{2}$")
STS_NUMBER_RE = re.compile(r"^\d{6}$")
PLATE_NUMBER_RE = re.compile(
    r"^[АВЕКМНОРСТУХABEKMHOPCTYX]\d{3}[АВЕКМНОРСТУХABEKMHOPCTYX]{2}\d{2,3}$"
)
MRZ_SECOND_LINE_RE = re.compile(
    r"^(?P<passport_no>\d{10})[A-Z<]{3}(?P<birth>\d{6})\d(?P<gender>[MF])[A-Z0-9<]*$"
)
DEFAULT_LLM_TIMEOUT_SECONDS = 45
DEFAULT_MAX_RETRIES = 2
DEFAULT_RETRY_BASE_DELAY = 0.8
DEFAULT_MIN_CONFIDENCE = 0.75
CURRENT_YEAR = date.today().year

PASSPORT_STOPWORDS = {
    "РОССИЙСКАЯ",
    "ФЕДЕРАЦИЯ",
    "ОБЛАСТИ",
    "ОБЛАСТЬ",
    "ПАСПОРТ",
    "ГУ",
    "МВД",
    "РОССИИ",
    "ЖЕН",
    "МУЖ",
    "МЕСТО",
    "ЖИТЕЛЬСТВА",
    "ЗАРЕГИСТРИРОВАН",
}


def _is_valid_passport_full_name(value: Any) -> bool:
    normalized = re.sub(r"\s+", " ", str(value or "").upper()).strip()
    if not normalized:
        return False
    words = normalized.split()
    if len(words) < 2:
        return False
    if any(word in PASSPORT_STOPWORDS for word in words):
        return False
    return all(re.fullmatch(r"[А-ЯЁ-]{2,}", word) for word in words)


def _resolve_openrouter_config() -> tuple[str, str, str]:
    api_key = getattr(settings, "OPENROUTER_API_KEY", "") or ""
    if not api_key:
        raise DocumentRecognitionError("OPENROUTER_API_KEY не задан")
    base_url = (
        getattr(settings, "OPENROUTER_BASE_URL", "") or "https://openrouter.ai/api/v1"
    )
    model = getattr(settings, "OPENROUTER_MODEL", "") or "gpt-5.2"
    return api_key, base_url, model


def _to_data_uri(image_bytes: bytes, mime_type: str) -> str:
    encoded = base64.b64encode(image_bytes).decode("utf-8")
    return f"data:{mime_type};base64,{encoded}"


def _render_pdf_pages(pdf_bytes: bytes) -> list[bytes]:
    images: list[bytes] = []
    with pymupdf.open(stream=pdf_bytes, filetype="pdf") as doc:
        for page in doc:
            pix = page.get_pixmap(dpi=180)
            images.append(pix.tobytes("png"))
    return images


def _image_to_png_bytes(image: Image.Image) -> bytes:
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def _render_image_with_rotations(image_bytes: bytes) -> tuple[bytes, list[bytes]]:
    with Image.open(BytesIO(image_bytes)) as source:
        normalized = ImageOps.exif_transpose(source).convert("RGB")
        primary = _image_to_png_bytes(normalized)
        rotated = [
            _image_to_png_bytes(normalized.rotate(angle, expand=True))
            for angle in (90, 180, 270)
        ]
    return primary, rotated


def _normalize_document_type(value: Any) -> str | None:
    text = str(value or "").strip().lower()
    aliases = {
        "passport": "passport",
        "паспорт": "passport",
        "паспорт рф": "passport",
        "driver_license": "driver_license",
        "driver licence": "driver_license",
        "driver license": "driver_license",
        "в/у": "driver_license",
        "водительское удостоверение": "driver_license",
        "epts": "epts",
        "эптс": "epts",
        "электронный птс": "epts",
        "sts": "sts",
        "стс": "sts",
        "свидетельство о регистрации тс": "sts",
        "свидетельство о регистрации транспортного средства": "sts",
        "vehicle_registration_certificate": "sts",
        "unknown": None,
    }
    return aliases.get(text)


def _normalize_date(value: Any) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    match = DATE_YYYYMMDD_RE.fullmatch(text)
    if match:
        return text
    match = DATE_DDMMYYYY_RE.fullmatch(text)
    if match:
        day, month, year = match.groups()
        return f"{year}-{month}-{day}"
    return text


def _normalize_confidence(value: Any) -> float | None:
    if value is None:
        return None
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    if parsed > 1:
        parsed = parsed / 100
    if parsed < 0:
        return 0.0
    if parsed > 1:
        return 1.0
    return round(parsed, 4)


def _normalize_data(
    document_type: str | None, payload: dict[str, Any]
) -> dict[str, Any]:
    normalized: dict[str, Any] = {}
    for key, value in payload.items():
        if isinstance(value, str):
            normalized[key] = value.strip()
        else:
            normalized[key] = value

    date_fields = {
        "passport": {"birth_date", "issue_date"},
        "driver_license": {"birth_date", "issue_date", "expiry_date"},
        "epts": {"issue_date"},
        "sts": {"issue_date"},
    }
    for key in date_fields.get(document_type or "", set()):
        if key in normalized:
            normalized[key] = _normalize_date(normalized.get(key))

    vin = normalized.get("vin")
    if isinstance(vin, str):
        normalized["vin"] = vin.strip().upper()
    return normalized


def _looks_like_registration_page(text: str) -> bool:
    upper = text.upper()
    return "МЕСТО ЖИТЕЛЬСТВА" in upper or "ЗАРЕГИСТРИРОВАН" in upper


def _is_reasonable_iso_date(value: str) -> bool:
    if not DATE_YYYYMMDD_RE.fullmatch(value):
        return False
    year = int(value[:4])
    if year < 1900 or year > CURRENT_YEAR + 10:
        return False
    return True


def _as_int(value: Any) -> int | None:
    text = str(value or "").strip()
    if not text:
        return None
    text = re.sub(r"[^\d]", "", text)
    if not text:
        return None
    return int(text)


def _normalize_vin(value: Any) -> str:
    text = re.sub(r"[^A-Z0-9]", "", str(value or "").upper())
    if not text:
        return ""
    return text


def _to_iso_date_from_ddmmyyyy(text: str) -> str:
    match = DATE_DDMMYYYY_RE.fullmatch(text.strip())
    if not match:
        return ""
    day, month, year = match.groups()
    return f"{year}-{month}-{day}"


def _extract_mrz_lines(text: str) -> tuple[str, str]:
    lines = [line.strip().upper() for line in text.splitlines() if line.strip()]
    first = ""
    second = ""
    for idx, line in enumerate(lines):
        if line.startswith("PNRUS"):
            first = line
            if idx + 1 < len(lines):
                second = lines[idx + 1].replace(" ", "")
            break
    return first, second


def _guess_full_name(lines: list[str]) -> str:
    normalized_lines = [line.strip().upper() for line in lines if line.strip()]
    candidates: list[tuple[int, str]] = []
    for idx, line in enumerate(normalized_lines):
        if not re.fullmatch(r"[А-ЯЁ-]{2,}", line):
            continue
        if line in PASSPORT_STOPWORDS:
            continue
        if any(token in PASSPORT_STOPWORDS for token in line.split()):
            continue
        candidates.append((idx, line))

    for pos in range(0, len(candidates) - 2):
        i1, p1 = candidates[pos]
        i2, p2 = candidates[pos + 1]
        i3, p3 = candidates[pos + 2]
        if i2 == i1 + 1 and i3 == i2 + 1:
            return f"{p1} {p2} {p3}"
    return ""


def _extract_registration_address(lines: list[str]) -> str:
    start_idx = -1
    for idx, line in enumerate(lines):
        if "ЗАРЕГИСТРИРОВАН" in line.upper():
            start_idx = idx
            break
    if start_idx < 0:
        return ""

    collected: list[str] = []
    for line in lines[start_idx + 1 :]:
        upper = line.upper()
        if (
            "ОТДЕЛ" in upper
            or "ПОДРАЗДЕЛ" in upper
            or "МИГРАЦ" in upper
            or "ЗАВЕР" in upper
        ):
            break
        if line.strip():
            collected.append(line.strip())
    return ", ".join(collected).strip(", ")


def _infer_passport_data_from_text(text: str) -> dict[str, Any]:
    if not text.strip():
        return {}

    lines = [line.strip() for line in text.splitlines() if line.strip()]
    joined = "\n".join(lines)
    inferred: dict[str, Any] = {}

    full_name = _guess_full_name(lines)
    if full_name:
        inferred["full_name"] = full_name

    gender = ""
    upper_text = joined.upper()
    if "ЖЕН" in upper_text:
        gender = "Ж"
    elif "МУЖ" in upper_text:
        gender = "М"
    if gender:
        inferred["gender"] = gender

    issuer_code_match = ISSUER_CODE_RE.search(joined)
    if issuer_code_match:
        inferred["issuer_code"] = issuer_code_match.group(1)

    all_dates = [m.group(0) for m in DATE_ANY_RE.finditer(joined)]
    if all_dates and not _looks_like_registration_page(joined):
        inferred["issue_date"] = _to_iso_date_from_ddmmyyyy(all_dates[0])
    if len(all_dates) > 1:
        inferred["birth_date"] = _to_iso_date_from_ddmmyyyy(all_dates[-1])

    series_number_match = PASSPORT_SERIES_NUMBER_RE.search(joined.replace("\n", " "))
    if series_number_match:
        s1, s2, number = series_number_match.groups()
        inferred["series"] = f"{s1}{s2}"
        inferred["number"] = number

    mrz_first, mrz_second = _extract_mrz_lines(joined)
    if mrz_first and not inferred.get("full_name"):
        name_chunk = mrz_first.replace("PNRUS", "", 1)
        name_chunk = name_chunk.replace("<", " ").strip()
        if name_chunk:
            inferred["full_name_latin"] = re.sub(r"\s+", " ", name_chunk)
    if mrz_second:
        mrz_match = MRZ_SECOND_LINE_RE.fullmatch(mrz_second)
        if mrz_match:
            passport_no = mrz_match.group("passport_no")
            inferred.setdefault("series", passport_no[:4])
            inferred.setdefault("number", passport_no[4:])
            birth = mrz_match.group("birth")
            inferred.setdefault(
                "birth_date",
                f"19{birth[0:2]}-{birth[2:4]}-{birth[4:6]}",
            )
            inferred.setdefault(
                "gender", "Ж" if mrz_match.group("gender") == "F" else "М"
            )

    registration_address = _extract_registration_address(lines)
    if registration_address:
        inferred["registration_address"] = registration_address

    return {k: v for k, v in inferred.items() if v not in ("", None)}


def _merge_missing_data(
    existing: dict[str, Any], inferred: dict[str, Any]
) -> dict[str, Any]:
    merged = dict(existing)
    for key, value in inferred.items():
        current = merged.get(key)
        if current in (None, "", []):
            merged[key] = value
    return merged


def _merge_warnings(existing: list[str], extra: list[str]) -> list[str]:
    merged = [item for item in existing if item]
    for item in extra:
        if item and item not in merged:
            merged.append(item)
    return merged


def _reject_field(
    rejected: dict[str, str],
    warnings: list[str],
    field: str,
    reason: str,
) -> None:
    if field not in rejected:
        rejected[field] = reason
    warning_text = f"{field}: {reason}"
    if warning_text not in warnings:
        warnings.append(warning_text)


def _validate_passport_fields(
    data: dict[str, Any], extracted_text: str
) -> tuple[dict[str, Any], dict[str, str], list[str]]:
    validated: dict[str, Any] = {}
    rejected: dict[str, str] = {}
    warnings: list[str] = []
    is_registration_page = _looks_like_registration_page(extracted_text)

    for key, value in data.items():
        text = str(value).strip() if isinstance(value, str) else value
        if text in ("", None):
            continue
        if key == "series":
            normalized = re.sub(r"\D", "", str(text))
            if PASSPORT_SERIES_RE.fullmatch(normalized):
                validated[key] = normalized
            else:
                _reject_field(rejected, warnings, key, "ожидалось 4 цифры")
            continue
        if key == "number":
            normalized = re.sub(r"\D", "", str(text))
            if PASSPORT_NUMBER_RE.fullmatch(normalized):
                validated[key] = normalized
            else:
                _reject_field(rejected, warnings, key, "ожидалось 6 цифр")
            continue
        if key == "issuer_code":
            normalized = str(text).replace("/", "").strip()
            if ISSUER_CODE_RE.fullmatch(normalized):
                validated[key] = normalized
            else:
                _reject_field(rejected, warnings, key, "ожидался формат 000-000")
            continue
        if key in {"birth_date", "issue_date"}:
            normalized = _normalize_date(text)
            if not normalized or not _is_reasonable_iso_date(normalized):
                _reject_field(rejected, warnings, key, "некорректная дата")
                continue
            if key == "issue_date" and is_registration_page:
                _reject_field(
                    rejected,
                    warnings,
                    key,
                    "дата со страницы регистрации не считается датой выдачи",
                )
                continue
            validated[key] = normalized
            continue
        if key == "gender":
            normalized = str(text).upper()
            if normalized in {"Ж", "ЖЕН", "F"}:
                validated[key] = "Ж"
            elif normalized in {"М", "МУЖ", "M"}:
                validated[key] = "М"
            else:
                _reject_field(rejected, warnings, key, "невалидное значение пола")
            continue
        if key == "full_name":
            normalized = re.sub(r"\s+", " ", str(text).upper()).strip()
            if not _is_valid_passport_full_name(normalized):
                _reject_field(rejected, warnings, key, "ожидалось ФИО кириллицей")
                continue
            validated[key] = normalized
            continue
        if key == "registration_address":
            normalized = re.sub(r"\s+", " ", str(text)).strip(" ,")
            if len(normalized) < 8:
                _reject_field(rejected, warnings, key, "слишком короткий адрес")
                continue
            validated[key] = normalized
            continue
        validated[key] = text

    birth_date = str(validated.get("birth_date") or "")
    issue_date = str(validated.get("issue_date") or "")
    if birth_date and issue_date and issue_date < birth_date:
        validated.pop("issue_date", None)
        _reject_field(
            rejected, warnings, "issue_date", "дата выдачи раньше даты рождения"
        )
    return validated, rejected, warnings


def _validate_driver_license_fields(
    data: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, str], list[str]]:
    validated: dict[str, Any] = {}
    rejected: dict[str, str] = {}
    warnings: list[str] = []

    for key, value in data.items():
        text = str(value).strip() if isinstance(value, str) else value
        if text in ("", None):
            continue
        if key == "series":
            normalized = re.sub(r"[^A-ZА-ЯЁ0-9]", "", str(text).upper())
            if DL_SERIES_RE.fullmatch(normalized):
                validated[key] = normalized
            else:
                _reject_field(rejected, warnings, key, "некорректная серия ВУ")
            continue
        if key == "number":
            normalized = re.sub(r"\D", "", str(text))
            if DL_NUMBER_RE.fullmatch(normalized):
                validated[key] = normalized
            else:
                _reject_field(rejected, warnings, key, "некорректный номер ВУ")
            continue
        if key in {"birth_date", "issue_date", "expiry_date"}:
            normalized = _normalize_date(text)
            if not _is_reasonable_iso_date(normalized):
                _reject_field(rejected, warnings, key, "некорректная дата")
                continue
            validated[key] = normalized
            continue
        if key == "categories":
            if isinstance(value, list):
                raw_categories = [str(item).strip().upper() for item in value]
            else:
                raw_categories = [
                    item.strip().upper() for item in re.split(r"[,; ]+", str(text))
                ]
            categories = [
                cat
                for cat in raw_categories
                if cat and re.fullmatch(r"[A-ZА-ЯЁ0-9]{1,4}", cat)
            ]
            if categories:
                validated[key] = categories
            else:
                _reject_field(
                    rejected, warnings, key, "не удалось распознать категории"
                )
            continue
        validated[key] = text

    issue_date = str(validated.get("issue_date") or "")
    expiry_date = str(validated.get("expiry_date") or "")
    if issue_date and expiry_date and expiry_date < issue_date:
        validated.pop("expiry_date", None)
        _reject_field(
            rejected, warnings, "expiry_date", "срок действия раньше даты выдачи"
        )
    return validated, rejected, warnings


def _validate_sts_fields(
    data: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, str], list[str]]:
    validated: dict[str, Any] = {}
    rejected: dict[str, str] = {}
    warnings: list[str] = []

    for key, value in data.items():
        text = str(value).strip() if isinstance(value, str) else value
        if text in ("", None):
            continue
        if key == "vin":
            normalized = _normalize_vin(text)
            if VIN_RE.fullmatch(normalized):
                validated[key] = normalized
            else:
                _reject_field(rejected, warnings, key, "некорректный VIN")
            continue
        if key == "plate_number":
            normalized = re.sub(r"[^A-ZА-ЯЁ0-9]", "", str(text).upper())
            if PLATE_NUMBER_RE.fullmatch(normalized):
                validated[key] = normalized
            else:
                _reject_field(rejected, warnings, key, "некорректный госномер")
            continue
        if key == "sts_series":
            normalized = re.sub(r"[^A-ZА-ЯЁ0-9]", "", str(text).upper())
            if STS_SERIES_RE.fullmatch(normalized):
                validated[key] = normalized
            else:
                _reject_field(rejected, warnings, key, "некорректная серия СТС")
            continue
        if key == "sts_number":
            normalized = re.sub(r"\D", "", str(text))
            if STS_NUMBER_RE.fullmatch(normalized):
                validated[key] = normalized
            else:
                _reject_field(rejected, warnings, key, "некорректный номер СТС")
            continue
        if key == "issue_date":
            normalized = _normalize_date(text)
            if _is_reasonable_iso_date(normalized):
                validated[key] = normalized
            else:
                _reject_field(rejected, warnings, key, "некорректная дата")
            continue
        if key in {"year", "max_weight", "unladen_weight", "engine_power_hp"}:
            parsed = _as_int(text)
            if parsed is None:
                _reject_field(rejected, warnings, key, "ожидалось числовое значение")
                continue
            if key == "year" and (parsed < 1900 or parsed > CURRENT_YEAR + 1):
                _reject_field(rejected, warnings, key, "нереалистичный год")
                continue
            if key != "year" and parsed <= 0:
                _reject_field(
                    rejected, warnings, key, "значение должно быть положительным"
                )
                continue
            validated[key] = parsed
            continue
        validated[key] = text

    return validated, rejected, warnings


def _validate_epts_fields(
    data: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, str], list[str]]:
    validated: dict[str, Any] = {}
    rejected: dict[str, str] = {}
    warnings: list[str] = []

    for key, value in data.items():
        text = str(value).strip() if isinstance(value, str) else value
        if text in ("", None):
            continue
        if key == "vin":
            normalized = _normalize_vin(text)
            if VIN_RE.fullmatch(normalized):
                validated[key] = normalized
            else:
                _reject_field(rejected, warnings, key, "некорректный VIN")
            continue
        if key in {"issue_date"}:
            normalized = _normalize_date(text)
            if _is_reasonable_iso_date(normalized):
                validated[key] = normalized
            else:
                _reject_field(rejected, warnings, key, "некорректная дата")
            continue
        if key in {"year", "power_hp", "gross_weight", "curb_weight"}:
            parsed = _as_int(text)
            if parsed is None:
                _reject_field(rejected, warnings, key, "ожидалось числовое значение")
                continue
            if key == "year" and (parsed < 1900 or parsed > CURRENT_YEAR + 1):
                _reject_field(rejected, warnings, key, "нереалистичный год")
                continue
            if key != "year" and parsed <= 0:
                _reject_field(
                    rejected, warnings, key, "значение должно быть положительным"
                )
                continue
            validated[key] = parsed
            continue
        validated[key] = text

    return validated, rejected, warnings


def _postprocess_data(
    normalized_type: str | None,
    data: dict[str, Any],
    extracted_text: str,
) -> tuple[dict[str, Any], list[str], list[str], dict[str, str]]:
    warnings: list[str] = []
    rejected_fields: dict[str, str] = {}
    payload = dict(data)

    if normalized_type == "passport" and extracted_text:
        inferred = _infer_passport_data_from_text(extracted_text)
        payload = _merge_missing_data(payload, inferred)
        if inferred.get("full_name") and not _is_valid_passport_full_name(
            payload.get("full_name")
        ):
            payload["full_name"] = inferred["full_name"]

    if normalized_type == "passport":
        validated, rejected, local_warnings = _validate_passport_fields(
            payload, extracted_text
        )
    elif normalized_type == "driver_license":
        validated, rejected, local_warnings = _validate_driver_license_fields(payload)
    elif normalized_type == "sts":
        validated, rejected, local_warnings = _validate_sts_fields(payload)
    elif normalized_type == "epts":
        validated, rejected, local_warnings = _validate_epts_fields(payload)
    else:
        validated = {k: v for k, v in payload.items() if v not in ("", None, [], {})}
        rejected = {}
        local_warnings = []

    warnings = _merge_warnings(warnings, local_warnings)
    rejected_fields.update(rejected)
    accepted_fields = sorted(validated.keys())
    return validated, warnings, accepted_fields, rejected_fields


def _parse_response_payload(content: str) -> dict[str, Any]:
    cleaned = (content or "").strip()
    if not cleaned:
        raise DocumentRecognitionError("Пустой ответ модели")
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise DocumentRecognitionError(f"Не удалось разобрать JSON: {exc}") from exc


def _extract_response_json(message: Any) -> tuple[dict[str, Any], str]:
    tool_calls = getattr(message, "tool_calls", None) or []
    if tool_calls:
        first_call = tool_calls[0]
        function = getattr(first_call, "function", None)
        arguments = getattr(function, "arguments", "") if function else ""
        return _parse_response_payload(arguments), str(arguments or "")

    content = getattr(message, "content", "") or ""
    return _parse_response_payload(content), str(content)


def _normalize_recognition_payload(
    parsed_payload: dict[str, Any], transcript: str
) -> RecognitionPayload:
    raw_document_type = str(parsed_payload.get("document_type") or "").strip()
    normalized_type = _normalize_document_type(raw_document_type)
    if not raw_document_type:
        raw_document_type = normalized_type or "unknown"
    confidence = _normalize_confidence(parsed_payload.get("confidence"))
    warnings_raw = parsed_payload.get("warnings")
    warnings = (
        [str(item).strip() for item in warnings_raw if str(item).strip()]
        if isinstance(warnings_raw, list)
        else []
    )
    data_raw = parsed_payload.get("data")
    data = data_raw if isinstance(data_raw, dict) else {}
    data = _normalize_data(normalized_type, data)
    extracted_text = str(parsed_payload.get("extracted_text") or "").strip()
    data, validation_warnings, accepted_fields, rejected_fields = _postprocess_data(
        normalized_type,
        data,
        extracted_text,
    )
    warnings = _merge_warnings(warnings, validation_warnings)

    return RecognitionPayload(
        document_type=raw_document_type,
        normalized_type=normalized_type,
        confidence=confidence,
        warnings=warnings,
        data=data,
        accepted_fields=accepted_fields,
        rejected_fields=rejected_fields,
        extracted_text=extracted_text,
        transcript=transcript,
    )


def _create_with_retries(
    client: openai.OpenAI,
    *,
    model: str,
    messages: list[dict[str, Any]],
    timeout_seconds: int,
    max_retries: int,
    retry_base_delay: float,
):
    last_exc: Exception | None = None
    for attempt in range(max_retries + 1):
        try:
            return client.chat.completions.create(
                model=model,
                temperature=0,
                messages=messages,
                tools=[{"type": "function", "function": DOCUMENT_FUNCTION}],
                tool_choice={
                    "type": "function",
                    "function": {"name": "extract_document_data"},
                },
                timeout=timeout_seconds,
            )
        except Exception as exc:
            last_exc = exc
            if attempt >= max_retries:
                break
            delay = retry_base_delay * (2**attempt)
            logger.warning(
                "Повтор запроса к ИИ через %.2fs после ошибки: %s",
                delay,
                exc,
            )
            time.sleep(delay)
    raise DocumentRecognitionError(f"Ошибка запроса к ИИ: {last_exc}") from last_exc


def _recognize_from_images(
    client: openai.OpenAI,
    *,
    model: str,
    images: list[bytes],
    timeout_seconds: int,
    max_retries: int,
    retry_base_delay: float,
) -> RecognitionPayload:
    if not images:
        raise DocumentRecognitionError("Не переданы изображения для распознавания")
    user_content: list[dict[str, Any]] = [
        {
            "type": "text",
            "text": "Извлеки структурированные данные документа по схеме.",
        }
    ]
    for image_bytes in images:
        user_content.append(
            {
                "type": "image_url",
                "image_url": {"url": _to_data_uri(image_bytes, "image/png")},
            }
        )
    messages: list[dict[str, Any]] = [
        {"role": "system", "content": DOCUMENT_PROMPT},
        {"role": "user", "content": user_content},
    ]
    response = _create_with_retries(
        client,
        model=model,
        messages=messages,
        timeout_seconds=timeout_seconds,
        max_retries=max_retries,
        retry_base_delay=retry_base_delay,
    )
    message = response.choices[0].message
    parsed_payload, transcript = _extract_response_json(message)
    return _normalize_recognition_payload(parsed_payload, transcript)


def _recognition_quality_score(
    payload: RecognitionPayload,
) -> tuple[int, float, int, int]:
    confidence = payload.confidence if payload.confidence is not None else -1.0
    return (
        1 if payload.normalized_type else 0,
        confidence,
        len(payload.data),
        -len(payload.warnings),
    )


def _needs_rotation_fallback(
    payload: RecognitionPayload, min_confidence: float
) -> bool:
    if payload.normalized_type is None:
        return True
    confidence = payload.confidence
    if confidence is None:
        return True
    return confidence < min_confidence


def recognize_document_from_file(content: bytes, filename: str) -> RecognitionPayload:
    api_key, base_url, model = _resolve_openrouter_config()
    client = openai.OpenAI(api_key=api_key, base_url=base_url)
    timeout_seconds = int(
        getattr(
            settings,
            "DOCUMENT_RECOGNITION_LLM_TIMEOUT_SECONDS",
            DEFAULT_LLM_TIMEOUT_SECONDS,
        )
    )
    max_retries = int(
        getattr(
            settings,
            "DOCUMENT_RECOGNITION_LLM_MAX_RETRIES",
            DEFAULT_MAX_RETRIES,
        )
    )
    retry_base_delay = float(
        getattr(
            settings,
            "DOCUMENT_RECOGNITION_LLM_RETRY_BASE_DELAY",
            DEFAULT_RETRY_BASE_DELAY,
        )
    )
    min_confidence = float(
        getattr(
            settings,
            "DOCUMENT_RECOGNITION_MIN_CONFIDENCE_FOR_SINGLE_PASS",
            DEFAULT_MIN_CONFIDENCE,
        )
    )

    if (filename or "").lower().endswith(".pdf"):
        images = _render_pdf_pages(content)
        if not images:
            raise DocumentRecognitionError(
                "Не удалось подготовить изображения для распознавания"
            )
        return _recognize_from_images(
            client,
            model=model,
            images=images,
            timeout_seconds=timeout_seconds,
            max_retries=max_retries,
            retry_base_delay=retry_base_delay,
        )

    primary_image, rotated_images = _render_image_with_rotations(content)
    if not primary_image:
        raise DocumentRecognitionError(
            "Не удалось подготовить изображения для распознавания"
        )
    best = _recognize_from_images(
        client,
        model=model,
        images=[primary_image],
        timeout_seconds=timeout_seconds,
        max_retries=max_retries,
        retry_base_delay=retry_base_delay,
    )
    if not _needs_rotation_fallback(best, min_confidence):
        return best

    for rotated_image in rotated_images:
        candidate = _recognize_from_images(
            client,
            model=model,
            images=[rotated_image],
            timeout_seconds=timeout_seconds,
            max_retries=max_retries,
            retry_base_delay=retry_base_delay,
        )
        if _recognition_quality_score(candidate) > _recognition_quality_score(best):
            best = candidate
        if not _needs_rotation_fallback(best, min_confidence):
            break
    return best
