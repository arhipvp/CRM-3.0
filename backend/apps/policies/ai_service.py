"""Сервис распознавания полисов через OpenAI."""

from __future__ import annotations

from io import BytesIO
import json
import logging
from typing import Callable, List, Tuple

import openai
from PyPDF2 import PdfReader
from django.conf import settings

logger = logging.getLogger(__name__)

try:
    from jsonschema import ValidationError, validate
except ModuleNotFoundError:  # pragma: no cover - optional dependency
    ValidationError = Exception

    def validate(instance, schema):  # type: ignore[unused-argument]
        """Пустая проверка схемы, если jsonschema недоступна."""
        logger.warning("jsonschema не установлен, проверка схемы пропущена")


DEFAULT_PROMPT = """Ты — ассистент, отвечающий за импорт данных из страховых полисов в CRM. На основе загруженного документа (PDF, скан или текст) необходимо сформировать один JSON строго по следующему шаблону:
{
  "client_name": "Тестовый клиент",
  "policy": {
    "policy_number": "TEST-002-ZXC",
    "insurance_type": "КАСКО",
    "insurance_company": "Ингосстрах",
    "contractor": "",
    "sales_channel": "",
    "start_date": "2025-07-01",
    "end_date": "2026-06-30",
    "vehicle_brand": "Hyundai",
    "vehicle_model": "Solaris",
    "vehicle_vin": "Z94CB41ABFR123456",
    "note": "импортировано через ChatGPT"
  },
  "payments": [
    {
      "amount": 2000,
      "payment_date": "2025-07-05",
      "actual_payment_date": "2025-07-05"
    }
  ]
}
📌 ОБЩИЕ ПРАВИЛА
Только по документу. Никаких догадок или вымышленных данных.

Один полис = один JSON. Даже если имя клиента одно.

Объединяй полисы в один JSON только если:
Один и тот же страхуемый объект,
Совпадает период страхования,
Одна страховая компания.

🧠 СПЕЦИАЛЬНЫЕ ПРАВИЛА
note
Всегда "импортировано через ChatGPT" — без исключений.

actual_payment_date
Всегда равен payment_date, даже если явно не указан.

contractor
Всегда пустое поле. Никогда не заполняется, даже если страхователь указан в документе.

sales_channel
Если в документе указаны фамилии агентов ("Марьинских", "Лежнев", "Музыченко") — это канал продаж

insurance_type
Если страхуется жизнь и здоровье заемщика по ипотеке — указывать "Ипотека".
Если можно определить тип полиса (например, "Жизнь" или "Квартира"), указывать его.
Не использовать "Несчастный случай", даже если он явно указан.

vehicle_vin
Если указан — обязательно включить.
Если не указан — оставить пустым ("").

payments
Если есть общий график — использовать его.
Если указаны только частичные платежи — использовать их.
Если вообще нет дат платежей — считать, что первый платеж = start_date.

Формат дат
Всегда в ISO-формате: YYYY-MM-DD.
Дата окончания полиса не может быть больше даты начала + 1 год. Если полис больше чем на 1 год, то ставь дату окончания полиса = дата начала действия + 1 год

🧹 ОБРАБОТКА ТЕКСТА
Удаляй пробелы, табуляции, переносы строк и мусор.
Значения полей должны быть очищены и отформатированы.
Не допускаются значения null, -, N/A, undefined и т.п.

📋 ПОРЯДОК ОБРАБОТКИ
Определи количество полисов в документе.
Для каждого полиса:
Определи объект страхования, страховую, тип, даты.
Если объект, даты и страховая совпадают — объединяй номера через запятую в policy_number.
Иначе — создавай отдельный JSON.
Извлеки и очисти все поля по правилам выше.
Сформируй итоговый JSON.

✅ ЧЕКЛИСТ ПЕРЕД ВЫДАЧЕЙ JSON
 note = "импортировано через ChatGPT"
 actual_payment_date = payment_date
 Все даты в формате YYYY-MM-DD
 VIN указан? → обязателен
 contractor = "" всегда
 insurance_type корректно определён (при возможности)
 Не используется "Несчастный случай"
 Несколько полисов объединены корректно?
 Нет null, -, N/A и прочего
"""


def _build_prompt(extra_companies: List[str] | None = None) -> str:
    """Вернуть системный промпт для распознавания полисов."""

    prompt = getattr(settings, "AI_POLICY_PROMPT", "") or DEFAULT_PROMPT
    if extra_companies:
        companies_line = ", ".join(extra_companies)
        prompt += (
            "\n\nСправочник CRM содержит следующие страховые компании: "
            f"{companies_line}. Используй точное название из этого списка."
        )
    return prompt


def _log_conversation(label: str, messages: List[dict]) -> str:
    """Залогировать диалог и вернуть транскрипт."""

    transcript = "\n".join(f"{m['role']}: {m['content']}" for m in messages)
    logger.info("Диалог с OpenAI для %s:\n%s", label, transcript)
    return transcript


MAX_ATTEMPTS = 3
REMINDER = "Ответ должен содержать только один валидный JSON без лишних пояснений."

POLICY_SCHEMA = {
    "type": "object",
    "properties": {
        "client_name": {"type": "string"},
        "policy": {
            "type": "object",
            "properties": {
                "policy_number": {"type": "string"},
                "insurance_type": {"type": "string"},
                "insurance_company": {"type": "string"},
                "contractor": {"type": "string"},
                "sales_channel": {"type": "string"},
                "start_date": {"type": "string"},
                "end_date": {"type": "string"},
                "vehicle_brand": {"type": "string"},
                "vehicle_model": {"type": "string"},
                "vehicle_vin": {"type": "string"},
                "note": {"type": "string"},
            },
            "required": [
                "policy_number",
                "insurance_type",
                "insurance_company",
                "contractor",
                "sales_channel",
                "start_date",
                "end_date",
                "vehicle_brand",
                "vehicle_model",
                "vehicle_vin",
                "note",
            ],
            "additionalProperties": False,
        },
        "payments": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "amount": {"type": "number"},
                    "payment_date": {"type": "string"},
                    "actual_payment_date": {"type": "string"},
                },
                "required": ["amount", "payment_date", "actual_payment_date"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["client_name", "policy", "payments"],
    "additionalProperties": False,
}

POLICY_FUNCTION = {
    "name": "extract_policy",
    "description": "Структурированный JSON результата распознавания полиса",
    "parameters": POLICY_SCHEMA,
}


def _extract_text_from_bytes(content: bytes, filename: str) -> str:
    """Извлечь текст из PDF или текстового файла."""

    if filename.lower().endswith(".pdf"):
        try:
            reader = PdfReader(content if hasattr(content, "read") else BytesIO(content))
            text = "\n".join(page.extract_text() or "" for page in reader.pages)
            if text:
                return text
        except Exception as exc:
            logger.warning("Не удалось прочитать PDF %s: %s", filename, exc)
    try:
        return content.decode("utf-8")
    except UnicodeDecodeError:
        return content.decode("utf-8", "ignore")


class PolicyRecognitionError(ValueError):
    """Ошибка распознавания полиса."""

    def __init__(self, message: str, transcript: str | None = None):
        super().__init__(message)
        self.transcript = transcript or ""


def _chat(
    messages: List[dict],
    *,
    progress_cb: Callable[[str, str], None] | None = None,
    cancel_cb: Callable[[], bool] | None = None,
) -> str:
    api_key = settings.OPENAI_API_KEY
    if not api_key:
        raise ValueError("OPENAI_API_KEY не задан")
    base_url = getattr(settings, "OPENAI_BASE_URL", None)
    model = getattr(settings, "OPENAI_MODEL", "gpt-4o")
    client = openai.OpenAI(api_key=api_key, base_url=base_url)

    tools = [{"type": "function", "function": POLICY_FUNCTION}]
    tool_choice = {"type": "function", "function": {"name": POLICY_FUNCTION["name"]}}

    def _check_cancel() -> None:
        if cancel_cb and cancel_cb():
            logger.info("Запрос к OpenAI отменён пользователем")
            raise InterruptedError("Запрос к OpenAI отменён")

    if progress_cb:
        stream = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0,
            stream=True,
            tools=tools,
            tool_choice=tool_choice,
        )
        parts: List[str] = []
        try:
            for chunk in stream:
                _check_cancel()
                delta = chunk.choices[0].delta if chunk.choices else None
                tool_calls = delta.tool_calls if delta else None
                if not tool_calls:
                    continue
                func = tool_calls[0].function if tool_calls else None
                if not func:
                    continue
                part = func.arguments or ""
                if part:
                    parts.append(part)
                    if progress_cb:
                        progress_cb("assistant", part)
        finally:
            close_method = getattr(stream, "close", None)
            if callable(close_method):
                close_method()
        return "".join(parts)

    resp = client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=0,
        tools=tools,
        tool_choice=tool_choice,
    )
    return resp.choices[0].message.tool_calls[0].function.arguments


def recognize_policy_interactive(
    text: str,
    *,
    messages: List[dict] | None = None,
    extra_companies: List[str] | None = None,
    progress_cb: Callable[[str, str], None] | None = None,
    cancel_cb: Callable[[], bool] | None = None,
) -> Tuple[dict, str, List[dict]]:
    """Распознать полис и вернуть JSON, транскрипт и сообщения."""

    def _check_cancel() -> None:
        if cancel_cb and cancel_cb():
            logger.info("Cancelling policy recognition")
            raise InterruptedError("Распознавание полиса отменено")

    if not messages:
        messages = [
            {"role": "system", "content": _build_prompt(extra_companies)},
            {"role": "user", "content": text[:16000]},
        ]
    _check_cancel()
    if progress_cb:
        for message in messages:
            _check_cancel()
            progress_cb(message["role"], message["content"])

    for attempt in range(MAX_ATTEMPTS):
        _check_cancel()
        answer = _chat(messages, progress_cb=progress_cb, cancel_cb=cancel_cb)
        messages.append({"role": "assistant", "content": answer})
        try:
            data = json.loads(answer)
            validate(instance=data, schema=POLICY_SCHEMA)
        except json.JSONDecodeError as exc:
            if attempt == MAX_ATTEMPTS - 1:
                transcript = _log_conversation("text", messages)
                raise PolicyRecognitionError(f"Не удалось разобрать JSON: {exc}", transcript)
            if progress_cb:
                progress_cb("user", REMINDER)
            messages.append({"role": "user", "content": REMINDER})
            continue
        except ValidationError as exc:
            if attempt == MAX_ATTEMPTS - 1:
                transcript = _log_conversation("text", messages)
                raise PolicyRecognitionError(f"Ошибка валидации схемы: {exc}", transcript)
            if progress_cb:
                progress_cb("user", REMINDER)
            messages.append({"role": "user", "content": REMINDER})
            continue
        _check_cancel()
        transcript = _log_conversation("text", messages)
        return data, transcript, messages

    raise PolicyRecognitionError("Не удалось получить валидный JSON", "")


def recognize_policy_from_text(
    text: str,
    *,
    extra_companies: List[str] | None = None,
) -> Tuple[dict, str]:
    """Распознать полис по тексту."""

    data, transcript, _ = recognize_policy_interactive(text, extra_companies=extra_companies)
    return data, transcript


def recognize_policy_from_bytes(
    content: bytes,
    *,
    filename: str,
    extra_companies: List[str] | None = None,
) -> Tuple[dict, str]:
    """Распознать полис по содержимому файла."""

    text = _extract_text_from_bytes(content, filename)
    return recognize_policy_from_text(text, extra_companies=extra_companies)
