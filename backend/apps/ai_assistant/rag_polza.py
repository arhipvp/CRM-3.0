"""Polza chat and embedding HTTP transport. Secrets never leave this module."""

from __future__ import annotations

import json
import math
from collections.abc import Callable

import httpx
from django.conf import settings


class AnswerStopped(Exception):
    """A user requested cancellation before the provider stream completed."""

    def __init__(self, usage: dict | None = None) -> None:
        super().__init__("Генерация остановлена пользователем.")
        self.usage = usage or {}


def _base_url() -> str:
    return getattr(settings, "AI_BASE_URL", "https://polza.ai/api/v1").rstrip("/")


def _headers() -> dict[str, str]:
    key = getattr(settings, "AI_API_KEY", "")
    if not key:
        raise RuntimeError("Не настроен ключ Polza для ИИ-помощника.")
    return {"Authorization": f"Bearer {key}"}


def default_model() -> str:
    return getattr(settings, "AI_ASSISTANT_CHAT_MODEL", "") or settings.AI_MODEL


def get_models() -> list[str]:
    with httpx.Client(timeout=30) as client:
        response = client.get(f"{_base_url()}/models", headers=_headers())
        response.raise_for_status()
        data = response.json()
    items = data.get("data", data) if isinstance(data, dict) else data
    if not isinstance(items, list):
        return [default_model()]
    models = sorted(
        {
            item["id"]
            for item in items
            if isinstance(item, dict) and isinstance(item.get("id"), str)
        }
    )
    return models or [default_model()]


def embed(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []
    model = getattr(settings, "AI_ASSISTANT_EMBEDDING_MODEL", "text-embedding-3-large")
    batch_size = max(1, int(getattr(settings, "AI_ASSISTANT_EMBEDDING_BATCH_SIZE", 32)))
    vectors: list[list[float]] = []
    with httpx.Client(timeout=90) as client:
        for start in range(0, len(texts), batch_size):
            batch = texts[start : start + batch_size]
            response = client.post(
                f"{_base_url()}/embeddings",
                headers=_headers(),
                json={"input": batch, "model": model, "encoding_format": "float"},
            )
            response.raise_for_status()
            items = response.json()["data"]
            ordered = sorted(items, key=lambda item: item["index"])
            if len(ordered) != len(batch):
                raise RuntimeError("Polza вернула неполный набор эмбеддингов.")
            for item in ordered:
                vector = item["embedding"]
                length = math.sqrt(sum(value * value for value in vector))
                if not length:
                    raise RuntimeError("Polza вернула нулевой эмбеддинг.")
                vectors.append([value / length for value in vector])
    return vectors


def _usage(event: dict, model: str) -> dict:
    raw = event.get("usage") if isinstance(event.get("usage"), dict) else event
    cost = raw.get("cost_rub", event.get("cost_rub"))
    try:
        cost = float(cost) if cost is not None else None
    except (TypeError, ValueError):
        cost = None
    input_tokens = raw.get("prompt_tokens", raw.get("input_tokens"))
    output_tokens = raw.get("completion_tokens", raw.get("output_tokens"))
    total_tokens = raw.get("total_tokens")
    if total_tokens is None and input_tokens is not None and output_tokens is not None:
        total_tokens = input_tokens + output_tokens
    return {
        "provider": "polza",
        "model": model,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "total_tokens": total_tokens,
        "cost_rub": cost,
    }


def generate_answer(
    question: str,
    history: list[dict],
    citations: list[dict],
    model: str,
    on_delta: Callable[[str], None],
    should_stop: Callable[[], bool],
) -> dict:
    from .rag_prompt import SYSTEM_PROMPT, build_prompt

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": build_prompt(question, history, citations)},
        ],
        "stream": True,
        "stream_options": {"include_usage": True},
    }
    usage = _usage({}, model)
    with httpx.Client(timeout=httpx.Timeout(30, read=180)) as client:
        with client.stream(
            "POST",
            f"{_base_url()}/chat/completions",
            headers={**_headers(), "Content-Type": "application/json"},
            json=payload,
        ) as response:
            if response.status_code >= 400:
                # Provider responses may echo request details; do not persist them.
                raise RuntimeError(f"Polza вернула HTTP {response.status_code}.")
            for line in response.iter_lines():
                if should_stop():
                    raise AnswerStopped(usage)
                if not line.startswith("data:"):
                    continue
                data = line[5:].strip()
                if data == "[DONE]":
                    break
                try:
                    event = json.loads(data)
                except json.JSONDecodeError:
                    continue
                if isinstance(event.get("usage"), dict):
                    usage = _usage(event, model)
                elif event.get("cost_rub") is not None:
                    usage = {**usage, "cost_rub": _usage(event, model)["cost_rub"]}
                choices = event.get("choices") or []
                if choices and isinstance(choices[0], dict):
                    delta = choices[0].get("delta", {}).get("content")
                    if isinstance(delta, str) and delta:
                        on_delta(delta)
    return usage
