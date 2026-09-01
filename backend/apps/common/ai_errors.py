"""Безопасная классификация ошибок AI-провайдеров."""

from __future__ import annotations

import html
import re
from html.parser import HTMLParser
from typing import Any

import openai


class _HtmlTextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        self.parts.append(data)


def sanitize_provider_text(value: Any, *, limit: int = 500) -> str:
    """Вернуть короткий текст провайдера без разметки и секретного контекста."""

    if not isinstance(value, str):
        return ""
    parser = _HtmlTextExtractor()
    try:
        parser.feed(value)
        value = " ".join(parser.parts)
    except (ValueError, TypeError):
        value = re.sub(r"<[^>]+>", " ", value)
    value = html.unescape(value)
    value = re.sub(r"\s+", " ", value).strip()
    # Ответы SDK иногда содержат конфигурацию запроса. Не показываем её пользователю.
    value = re.sub(
        r"(?i)\b(?:api[_ -]?key|authorization|bearer)\b(?:\s+|=|:)?[^\s,;]*",
        "",
        value,
    )
    return value[:limit].rstrip()


class AIRecognitionError(ValueError):
    """Доменная ошибка распознавания, безопасная для API-ответа."""

    def __init__(
        self,
        message: str,
        *,
        code: str = "ai_unknown_error",
        retryable: bool = False,
        status_code: int = 502,
        cause: Exception | None = None,
        provider_text: str = "",
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.retryable = retryable
        self.status_code = status_code
        self.cause = cause
        self.provider_text = provider_text


def _status_code(exc: Exception) -> int | None:
    status = getattr(exc, "status_code", None)
    if isinstance(status, int):
        return status
    response = getattr(exc, "response", None)
    status = getattr(response, "status_code", None)
    return status if isinstance(status, int) else None


def _provider_text(exc: Exception) -> str:
    if _status_code(exc) is None:
        return ""
    body = getattr(exc, "body", None)
    if isinstance(body, dict):
        body = body.get("message") or body.get("error") or ""
    text = body if isinstance(body, str) else str(exc)
    return sanitize_provider_text(text)


def classify_ai_error(
    exc: Exception, *, timeout_seconds: int | None = None
) -> AIRecognitionError:
    """Преобразовать SDK/HTTP ошибку Polza.ai в стабильный API-контракт."""

    if isinstance(exc, AIRecognitionError):
        return exc

    status = _status_code(exc)
    provider_text = _provider_text(exc)
    is_timeout = (
        isinstance(exc, getattr(openai, "APITimeoutError", ())) or status == 408
    )
    is_network = isinstance(exc, getattr(openai, "APIConnectionError", ()))

    if status == 402:
        code, message, retryable = (
            "ai_insufficient_funds",
            "На балансе Polza.ai недостаточно средств. Пополните баланс и повторите распознавание.",
            False,
        )
    elif is_timeout:
        suffix = f" ({timeout_seconds} сек.)" if timeout_seconds else ""
        code, message, retryable = (
            "ai_timeout",
            f"Превышено время ожидания ответа Polza.ai{suffix}.",
            True,
        )
    elif status == 429:
        code, message, retryable = (
            "ai_rate_limited",
            "Polza.ai временно ограничил число запросов. Повторите позже.",
            True,
        )
    elif status in {401, 403}:
        code, message, retryable = (
            "ai_authentication_failed",
            "Polza.ai отклонил авторизацию. Обратитесь к администратору.",
            False,
        )
    elif status == 400:
        code, message, retryable = (
            "ai_invalid_request",
            "Polza.ai не принял запрос на распознавание.",
            False,
        )
    elif is_network or status in {502, 503}:
        code, message, retryable = (
            "ai_provider_unavailable",
            "Polza.ai временно недоступен. Повторите позже.",
            True,
        )
    else:
        code, message, retryable = (
            "ai_unknown_error",
            "Не удалось выполнить распознавание через Polza.ai.",
            True,
        )

    if provider_text:
        message = f"{message} Ответ Polza.ai: {provider_text}"
    return AIRecognitionError(
        message,
        code=code,
        retryable=retryable,
        status_code=status or 502,
        cause=exc,
        provider_text=provider_text,
    )
