from __future__ import annotations

import base64
import json
import logging
import re
from dataclasses import dataclass
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
    },
    "required": ["document_type", "confidence", "warnings", "data"],
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
  "data": {...}
}

Правила:
1) Всегда пытайся определить тип документа и записать его в document_type понятным текстом.
2) Если тип определить нельзя, верни "unknown".
3) Предпочтительные каноничные значения, если уверен:
- passport
- driver_license
- epts
- sts
2) Никаких выдумок. Если поле не найдено: пустая строка или null (в зависимости от уместности).
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
"""

DATE_DDMMYYYY_RE = re.compile(r"^(\d{2})[./-](\d{2})[./-](\d{4})$")
DATE_YYYYMMDD_RE = re.compile(r"^(\d{4})-(\d{2})-(\d{2})$")

IMAGE_MIME_BY_EXT = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
    ".tif": "image/tiff",
    ".tiff": "image/tiff",
}


def _resolve_openrouter_config() -> tuple[str, str, str]:
    api_key = getattr(settings, "OPENROUTER_API_KEY", "") or ""
    if not api_key:
        raise DocumentRecognitionError("OPENROUTER_API_KEY не задан")
    base_url = (
        getattr(settings, "OPENROUTER_BASE_URL", "") or "https://openrouter.ai/api/v1"
    )
    model = getattr(settings, "OPENROUTER_MODEL", "") or "gpt-5.2"
    return api_key, base_url, model


def _guess_image_mime(filename: str) -> str:
    lower_name = (filename or "").lower()
    for ext, mime in IMAGE_MIME_BY_EXT.items():
        if lower_name.endswith(ext):
            return mime
    return "image/png"


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


def _render_image_with_rotations(image_bytes: bytes) -> list[bytes]:
    images: list[bytes] = []
    with Image.open(BytesIO(image_bytes)) as source:
        normalized = ImageOps.exif_transpose(source).convert("RGB")
        images.append(_image_to_png_bytes(normalized))
        for angle in (90, 180, 270):
            images.append(_image_to_png_bytes(normalized.rotate(angle, expand=True)))
    return images


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


def recognize_document_from_file(content: bytes, filename: str) -> RecognitionPayload:
    api_key, base_url, model = _resolve_openrouter_config()
    client = openai.OpenAI(api_key=api_key, base_url=base_url)

    images: list[bytes]
    if (filename or "").lower().endswith(".pdf"):
        images = _render_pdf_pages(content)
    else:
        images = _render_image_with_rotations(content)

    if not images:
        raise DocumentRecognitionError(
            "Не удалось подготовить изображения для распознавания"
        )

    mime_type = _guess_image_mime(filename)
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
                "image_url": {"url": _to_data_uri(image_bytes, mime_type)},
            }
        )

    response = client.chat.completions.create(
        model=model,
        temperature=0,
        messages=[
            {"role": "system", "content": DOCUMENT_PROMPT},
            {"role": "user", "content": user_content},
        ],
        tools=[{"type": "function", "function": DOCUMENT_FUNCTION}],
        tool_choice={"type": "function", "function": {"name": "extract_document_data"}},
    )
    message = response.choices[0].message
    parsed_payload, transcript = _extract_response_json(message)

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

    return RecognitionPayload(
        document_type=raw_document_type,
        normalized_type=normalized_type,
        confidence=confidence,
        warnings=warnings,
        data=data,
        transcript=transcript,
    )
