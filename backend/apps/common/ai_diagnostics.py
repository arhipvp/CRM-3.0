"""Изолированный полный журнал запросов к AI для production-диагностики."""

from __future__ import annotations

import base64
import json
import logging
import os
import re
import threading
from datetime import datetime, timezone
from logging.handlers import TimedRotatingFileHandler
from pathlib import Path
from typing import Any

from django.conf import settings

_LOGGER_NAME = "ai_diagnostics"
_HANDLER_MARKER = "crm3_ai_diagnostics"
_LOCK = threading.Lock()
_SECRET_VALUE_RE = re.compile(
    r"(?i)\b(?:bearer\s+|api[_ -]?key\s*[=:]\s*|authorization\s*[=:]\s*|token\s*[=:]\s*)[^\s,;\"]+"
)


def _prune_backups(directory: Path, *, retention_days: int) -> None:
    backups = sorted(
        (
            path
            for path in directory.glob("ai-diagnostics.jsonl.*")
            if path.is_file() and not path.is_symlink()
        ),
        key=lambda path: path.stat().st_mtime,
        reverse=True,
    )
    for path in backups[retention_days - 1 :]:
        path.unlink(missing_ok=True)


def _redact(value: Any, *, key: str = "") -> Any:
    """Сериализовать данные, не допуская попадания секретов в журнал."""

    normalized_key = key.lower().replace("-", "_")
    if any(
        token in normalized_key
        for token in ("api_key", "authorization", "token", "secret", "password")
    ):
        return "[REDACTED]"
    if isinstance(value, dict):
        return {
            str(item_key): _redact(item, key=str(item_key))
            for item_key, item in value.items()
        }
    if isinstance(value, (list, tuple)):
        return [_redact(item) for item in value]
    if isinstance(value, bytes):
        return {"encoding": "base64", "data": base64.b64encode(value).decode("ascii")}
    if isinstance(value, Path):
        return str(value)
    if isinstance(value, Exception):
        return {
            "type": type(value).__name__,
            "message": _SECRET_VALUE_RE.sub("[REDACTED]", str(value)),
        }
    model_dump = getattr(value, "model_dump", None)
    if callable(model_dump):
        return _redact(model_dump())
    return value


def _diagnostic_logger() -> logging.Logger | None:
    if not getattr(settings, "AI_DIAGNOSTICS_ENABLED", False):
        return None
    raw_directory = str(getattr(settings, "AI_DIAGNOSTICS_DIRECTORY", "")).strip()
    if not raw_directory:
        return None
    directory = Path(raw_directory).expanduser()
    retention_days = max(1, int(getattr(settings, "AI_DIAGNOSTICS_RETENTION_DAYS", 7)))
    target = directory / "ai-diagnostics.jsonl"
    logger = logging.getLogger(_LOGGER_NAME)
    with _LOCK:
        active = next(
            (
                handler
                for handler in logger.handlers
                if getattr(handler, _HANDLER_MARKER, False)
                and Path(getattr(handler, "baseFilename", "")) == target
            ),
            None,
        )
        if active is None:
            for handler in list(logger.handlers):
                if getattr(handler, _HANDLER_MARKER, False):
                    logger.removeHandler(handler)
                    handler.close()
            directory.mkdir(parents=True, exist_ok=True)
            os.chmod(directory, 0o700)
            _prune_backups(directory, retention_days=retention_days)
            handler = TimedRotatingFileHandler(
                target,
                when="midnight",
                interval=1,
                backupCount=retention_days - 1,
                encoding="utf-8",
                delay=True,
                utc=True,
            )
            setattr(handler, _HANDLER_MARKER, True)
            handler.setFormatter(logging.Formatter("%(message)s"))
            logger.addHandler(handler)
        logger.setLevel(logging.INFO)
        logger.propagate = False
    return logger


def log_ai_diagnostic(event: str, **payload: Any) -> None:
    """Записать полную диагностическую JSONL-запись вне stdout Docker."""

    logger = _diagnostic_logger()
    if logger is None:
        return
    record = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "event": event,
        **_redact(payload),
    }
    logger.info(
        json.dumps(record, ensure_ascii=False, default=str, separators=(",", ":"))
    )
    for handler in logger.handlers:
        if getattr(handler, _HANDLER_MARKER, False):
            try:
                os.chmod(handler.baseFilename, 0o600)
            except OSError:
                pass


def close_ai_diagnostics_handlers() -> None:
    """Закрыть file handlers; используется тестами перед удалением временных файлов."""

    logger = logging.getLogger(_LOGGER_NAME)
    with _LOCK:
        for handler in list(logger.handlers):
            if getattr(handler, _HANDLER_MARKER, False):
                logger.removeHandler(handler)
                handler.close()
