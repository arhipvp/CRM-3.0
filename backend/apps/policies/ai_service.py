"""Сервис распознавания полисов через OpenRouter."""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime
from decimal import Decimal, InvalidOperation
from io import BytesIO
from typing import Callable, List, Tuple

import openai
from django.conf import settings
from PyPDF2 import PdfReader

logger = logging.getLogger(__name__)

try:
    from jsonschema import ValidationError, validate
except ModuleNotFoundError:  # pragma: no cover - optional dependency
    HAVE_JSONSCHEMA = False
    ValidationError = Exception

    def validate(instance, schema):  # type: ignore[unused-argument]
        """Пустая проверка схемы, если jsonschema недоступна."""
        logger.warning("jsonschema не установлен, проверка схемы пропущена")

else:
    HAVE_JSONSCHEMA = True


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
Выбирай тип полиса строго из передаваемого справочника CRM: если документ явно говорит об ипотечном покрытии жизни — "Ипотечное страхование (жизнь)", об ипотечном покрытии имущества — "Ипотечное страхование (имущество)", о жизни и имуществе одновременно — "Комплексное ипотечное страхование". При авто- или имущественном покрытии обязателен точный выбор из списка ("Каско", "Авто. Прочее страхование", "ОСАГО" и т.п.), также страховщика выбирай из того же справочника. 
Если можно точно определить тип (например, "Жизнь" или "Квартира"), ищи полное совпадение по справочнику и используй его.
Не придумывай значения, если не получается подобрать запись из справочника, оставляй поле пустым ("").

vehicle_vin
Если указан — обязательно включить и убедиться, что он состоит строго из 17 латинских букв и цифр.
Если не указан — оставить пустым ("").

payments
Если есть общий график — использовать его.
Если указаны только частичные платежи — использовать их.
Если вообще нет дат платежей — считать, что первый платеж = start_date.
Всегда указывай сумму в поле amount как число без пробелов и разделителей.
Если в документе упоминается только общая страховая премия, используй её как единственный платеж и привязывай его к дате начала полиса.

Формат дат
Всегда в ISO-формате: YYYY-MM-DD.
Дата окончания полиса не может быть больше даты начала + 1 год. Если полис больше чем на 1 год, то ставь дату окончания полиса = дата начала действия + 1 год

🧹 ОБРАБОТКА ТЕКСТА
Удаляй пробелы, табуляции, переносы строк и мусор.
Значения полей должны быть очищены и отформатированы.
Не допускаются значения null, -, N/A, undefined и т.п.
Если не уверены в значении поля — оставляйте пустым строкой ("").

📋 ПОРЯДОК ОБРАБОТКИ
Определи количество полисов в документе.
Для каждого полиса:
Определи объект страхования, страховую компанию, тип, даты.
Извлеки и очисти все поля по правилам выше.
Сформируй итоговый JSON.

✅ ЧЕКЛИСТ ПЕРЕД ВЫДАЧЕЙ JSON
 note = "импортировано через ChatGPT"
 actual_payment_date = payment_date
 Все даты в формате YYYY-MM-DD
 VIN указан? → обязателен
 VIN состоит из 17 латинских букв и цифр
 contractor = "" всегда
 insurance_type корректно определён (при возможности)
  Нет null, -, N/A и прочего
"""


def _build_prompt(
    extra_companies: List[str] | None = None, extra_types: List[str] | None = None
) -> str:
    """Вернуть системный промпт для распознавания полисов."""

    prompt = getattr(settings, "AI_POLICY_PROMPT", "") or DEFAULT_PROMPT
    if extra_companies:
        companies_line = ", ".join(extra_companies)
        prompt += (
            "\n\nСправочник CRM содержит следующие страховые компании: "
            f"{companies_line}. Используй точное название из этого списка."
        )
    if extra_types:
        types_line = ", ".join(extra_types)
        prompt += (
            "\n\nСправочник CRM содержит следующие виды страхования: "
            f"{types_line}. Отображай значение только если оно есть в этом списке."
        )
    return prompt


def _log_conversation(label: str, messages: List[dict]) -> str:
    """Залогировать диалог и вернуть транскрипт."""

    transcript = "\n".join(f"{m['role']}: {m['content']}" for m in messages)
    logger.info("Диалог с OpenRouter для %s:\n%s", label, transcript)
    return transcript


def _resolve_ai_client_config() -> Tuple[str, str, str]:
    """Вернуть настройки доступа к OpenRouter."""

    api_key = getattr(settings, "OPENROUTER_API_KEY", "")
    if not api_key:
        raise ValueError("OPENROUTER_API_KEY не задан")
    model = getattr(settings, "OPENROUTER_MODEL", "") or "gpt-4o-mini"
    base_url = (
        getattr(settings, "OPENROUTER_BASE_URL", "") or OPENROUTER_DEFAULT_BASE_URL
    )
    return api_key, base_url, model


MAX_ATTEMPTS = 3
REMINDER = "Ответ должен содержать только один валидный JSON без лишних пояснений."
OPENROUTER_DEFAULT_BASE_URL = "https://openrouter.ai/api/v1"

DATE_PATTERN = r"^\\d{4}-\\d{2}-\\d{2}$"
VIN_PATTERN = r"^[A-Za-z0-9]{17}$"
AMOUNT_PATTERN = r"^-?\\d+(?:[\\.,]\\d{1,2})?$"

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
                "start_date": {"type": "string", "pattern": DATE_PATTERN},
                "end_date": {"type": "string", "pattern": DATE_PATTERN},
                "vehicle_brand": {"type": "string"},
                "vehicle_model": {"type": "string"},
                "vehicle_vin": {"type": "string", "pattern": f"^$|{VIN_PATTERN}"},
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
                    "amount": {
                        "anyOf": [
                            {"type": "number"},
                            {"type": "string", "pattern": AMOUNT_PATTERN},
                        ]
                    },
                    "payment_date": {"type": "string", "pattern": DATE_PATTERN},
                    "actual_payment_date": {"type": "string", "pattern": DATE_PATTERN},
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


def extract_text_from_bytes(content: bytes, filename: str) -> str:
    """Извлечь текст из PDF или текстового файла."""

    if filename.lower().endswith(".pdf"):
        try:
            reader = PdfReader(
                content if hasattr(content, "read") else BytesIO(content)
            )
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


def _basic_policy_validate(data: dict) -> None:
    """Минимальная валидация структуры, если jsonschema недоступен."""

    if not isinstance(data, dict):
        raise PolicyRecognitionError("Ответ должен быть объектом JSON")

    for key in ("client_name", "policy", "payments"):
        if key not in data:
            raise PolicyRecognitionError(f"Отсутствует ключ {key!r}")

    policy = data.get("policy")
    if not isinstance(policy, dict):
        raise PolicyRecognitionError("policy должен быть объектом JSON")

    required_policy_keys = (
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
    )
    for key in required_policy_keys:
        if key not in policy:
            raise PolicyRecognitionError(f"В policy отсутствует ключ {key!r}")

    date_re = re.compile(r"^\\d{4}-\\d{2}-\\d{2}$")
    for key in ("start_date", "end_date"):
        value = policy.get(key)
        if not isinstance(value, str) or not date_re.fullmatch(value):
            raise PolicyRecognitionError(f"{key} должен быть строкой YYYY-MM-DD")

    vin = policy.get("vehicle_vin")
    if not isinstance(vin, str):
        raise PolicyRecognitionError("vehicle_vin должен быть строкой")
    if vin and not re.fullmatch(r"^[A-Za-z0-9]{17}$", vin):
        raise PolicyRecognitionError(
            "vehicle_vin должен быть пустым или VIN из 17 символов"
        )

    payments = data.get("payments")
    if not isinstance(payments, list):
        raise PolicyRecognitionError("payments должен быть массивом")
    for idx, payment in enumerate(payments):
        if not isinstance(payment, dict):
            raise PolicyRecognitionError(f"payments[{idx}] должен быть объектом")
        for key in ("amount", "payment_date", "actual_payment_date"):
            if key not in payment:
                raise PolicyRecognitionError(
                    f"В payments[{idx}] отсутствует ключ {key!r}"
                )
        amount = payment.get("amount")
        if not isinstance(amount, (int, float, str)):
            raise PolicyRecognitionError(
                f"payments[{idx}].amount должен быть числом или строкой"
            )
        for key in ("payment_date", "actual_payment_date"):
            value = payment.get(key)
            if not isinstance(value, str) or not date_re.fullmatch(value):
                raise PolicyRecognitionError(
                    f"payments[{idx}].{key} должен быть YYYY-MM-DD"
                )


def _normalize_date(value: object) -> str:
    """Привести дату к YYYY-MM-DD, понимая популярные форматы."""

    if not isinstance(value, str):
        return ""
    raw = value.strip()
    if not raw:
        return ""
    if re.fullmatch(r"^\d{4}-\d{2}-\d{2}$", raw):
        return raw

    raw = raw.replace("\\", "/").replace(".", "-").replace("/", "-")
    raw = re.sub(r"\s+", "", raw)
    for fmt in ("%d-%m-%Y", "%d-%m-%y", "%Y-%m-%d", "%Y-%d-%m"):
        try:
            parsed = datetime.strptime(raw, fmt).date()
            return parsed.isoformat()
        except ValueError:
            continue
    return ""


def _normalize_amount(value: object) -> str:
    """Нормализовать сумму в строку без пробелов, с точкой как разделителем."""

    if value is None:
        return "0"
    if isinstance(value, (int, Decimal)):
        return str(value)
    if isinstance(value, float):
        # У float возможны хвосты, поэтому конвертируем через строку
        return str(Decimal(str(value)))
    if isinstance(value, str):
        raw = value.strip()
        if not raw:
            return "0"
        cleaned = (
            raw.replace("\u00a0", "")
            .replace(" ", "")
            .replace("руб.", "")
            .replace("руб", "")
            .replace("₽", "")
        )
        cleaned = cleaned.replace(",", ".")
        cleaned = re.sub(r"[^0-9.\\-]", "", cleaned)
        if cleaned in ("", "-", ".", "-."):
            return "0"
        try:
            return str(Decimal(cleaned))
        except InvalidOperation:
            return "0"
    return "0"


def _normalize_policy_payload(data: dict) -> dict:
    """Подчистить типовые ошибки распознавания перед валидацией."""

    if not isinstance(data, dict):
        return data
    policy = data.get("policy")
    if isinstance(policy, dict):
        for key in ("start_date", "end_date"):
            normalized = _normalize_date(policy.get(key))
            if normalized:
                policy[key] = normalized
        vin = policy.get("vehicle_vin")
        if isinstance(vin, str):
            policy["vehicle_vin"] = vin.strip()

    payments = data.get("payments")
    if isinstance(payments, list):
        for payment in payments:
            if not isinstance(payment, dict):
                continue
            payment["amount"] = _normalize_amount(payment.get("amount"))
            for key in ("payment_date", "actual_payment_date"):
                normalized = _normalize_date(payment.get(key))
                if normalized:
                    payment[key] = normalized
    return data


def _chat(
    messages: List[dict],
    *,
    progress_cb: Callable[[str, str], None] | None = None,
    cancel_cb: Callable[[], bool] | None = None,
) -> str:
    api_key, base_url, model = _resolve_ai_client_config()
    client_kwargs: dict[str, str] = {"api_key": api_key, "base_url": base_url}
    client = openai.OpenAI(**client_kwargs)
    logger.debug(
        "Используем OpenRouter (model=%s, base_url=%s)",
        model,
        base_url,
    )

    tools = [{"type": "function", "function": POLICY_FUNCTION}]
    tool_choice = {"type": "function", "function": {"name": POLICY_FUNCTION["name"]}}

    def _check_cancel() -> None:
        if cancel_cb and cancel_cb():
            logger.info("Запрос к OpenRouter отменён пользователем")
            raise InterruptedError("Запрос к OpenRouter отменён")

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
        content_parts: List[str] = []
        try:
            for chunk in stream:
                _check_cancel()
                delta = chunk.choices[0].delta if chunk.choices else None
                tool_calls = delta.tool_calls if delta else None
                if tool_calls:
                    func = tool_calls[0].function if tool_calls else None
                    if func:
                        part = func.arguments or ""
                        if part:
                            parts.append(part)
                            progress_cb("assistant", part)
                        continue
                content = getattr(delta, "content", None) if delta else None
                if content:
                    content_parts.append(content)
                    progress_cb("assistant", content)
        finally:
            close_method = getattr(stream, "close", None)
            if callable(close_method):
                close_method()
        return "".join(parts) or "".join(content_parts)

    resp = client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=0,
        tools=tools,
        tool_choice=tool_choice,
    )
    message = resp.choices[0].message
    tool_calls = getattr(message, "tool_calls", None)
    if tool_calls and tool_calls[0].function and tool_calls[0].function.arguments:
        return tool_calls[0].function.arguments
    content = getattr(message, "content", None) or ""
    if content:
        return content
    raise RuntimeError("OpenRouter вернул пустой ответ")


def recognize_policy_interactive(
    text: str,
    *,
    messages: List[dict] | None = None,
    extra_companies: List[str] | None = None,
    extra_types: List[str] | None = None,
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
            {
                "role": "system",
                "content": _build_prompt(extra_companies, extra_types),
            },
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
            data = _normalize_policy_payload(data)
            if HAVE_JSONSCHEMA:
                validate(instance=data, schema=POLICY_SCHEMA)
            else:
                _basic_policy_validate(data)
        except json.JSONDecodeError as exc:
            if attempt == MAX_ATTEMPTS - 1:
                transcript = _log_conversation("text", messages)
                raise PolicyRecognitionError(
                    f"Не удалось разобрать JSON: {exc}", transcript
                )
            if progress_cb:
                progress_cb("user", REMINDER)
            messages.append({"role": "user", "content": REMINDER})
            continue
        except ValidationError as exc:
            if attempt == MAX_ATTEMPTS - 1:
                transcript = _log_conversation("text", messages)
                raise PolicyRecognitionError(
                    f"Ошибка валидации схемы: {exc}", transcript
                )
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
    extra_types: List[str] | None = None,
) -> Tuple[dict, str]:
    """Распознать полис по тексту."""

    data, transcript, _ = recognize_policy_interactive(
        text, extra_companies=extra_companies, extra_types=extra_types
    )
    return data, transcript


def recognize_policy_from_bytes(
    content: bytes,
    *,
    filename: str,
    extra_companies: List[str] | None = None,
    extra_types: List[str] | None = None,
) -> Tuple[dict, str]:
    """Распознать полис по содержимому файла."""

    text = extract_text_from_bytes(content, filename)
    return recognize_policy_from_text(
        text, extra_companies=extra_companies, extra_types=extra_types
    )
