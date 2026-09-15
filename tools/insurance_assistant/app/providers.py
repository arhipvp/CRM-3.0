from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, AsyncIterator

import httpx


@dataclass(frozen=True)
class Usage:
    provider: str
    model: str
    input_tokens: int | None = None
    output_tokens: int | None = None
    total_tokens: int | None = None
    cost_rub: float | None = None

    def json(self) -> dict[str, Any]:
        return {
            "provider": self.provider,
            "model": self.model,
            "input_tokens": self.input_tokens,
            "output_tokens": self.output_tokens,
            "total_tokens": self.total_tokens,
            "cost_rub": self.cost_rub,
        }


@dataclass(frozen=True)
class ProviderEvent:
    delta: str = ""
    usage: Usage | None = None


def _int_value(data: dict[str, Any], *names: str) -> int | None:
    for name in names:
        value = data.get(name)
        if isinstance(value, int):
            return value
    return None


def _usage(data: dict[str, Any], model: str) -> Usage:
    raw = data.get("usage") if isinstance(data.get("usage"), dict) else data
    cost = raw.get("cost_rub", data.get("cost_rub"))
    try:
        cost_rub = float(cost) if cost is not None else None
    except (TypeError, ValueError):
        cost_rub = None
    input_tokens = _int_value(raw, "prompt_tokens", "input_tokens")
    output_tokens = _int_value(raw, "completion_tokens", "output_tokens")
    total_tokens = _int_value(raw, "total_tokens")
    if total_tokens is None and input_tokens is not None and output_tokens is not None:
        total_tokens = input_tokens + output_tokens
    return Usage(
        "polza",
        model,
        input_tokens,
        output_tokens,
        total_tokens,
        cost_rub,
    )


class PolzaTransport:
    def __init__(self, base_url: str, api_key: str | None) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key

    def _headers(self) -> dict[str, str]:
        if not self.api_key:
            raise RuntimeError("Не задан POLZA_AI_API_KEY для ответов Polza.ai.")
        return {"Authorization": f"Bearer {self.api_key}"}

    async def models(self) -> list[str]:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(
                f"{self.base_url}/models", headers=self._headers()
            )
            response.raise_for_status()
            payload = response.json()
        items = payload.get("data", payload) if isinstance(payload, dict) else payload
        if not isinstance(items, list):
            return []
        return sorted(
            {
                item["id"]
                for item in items
                if isinstance(item, dict)
                and isinstance(item.get("id"), str)
                and (
                    item.get("type") == "chat"
                    or "/chat/completions" in item.get("endpoints", [])
                )
            }
        )

    async def answer(self, prompt: str, model: str) -> AsyncIterator[ProviderEvent]:
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "stream": True,
            "stream_options": {"include_usage": True},
        }
        usage: Usage | None = None
        async with httpx.AsyncClient(timeout=180) as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/chat/completions",
                headers={**self._headers(), "Content-Type": "application/json"},
                json=payload,
            ) as response:
                if response.status_code >= 400:
                    detail = (await response.aread()).decode(errors="replace")
                    raise RuntimeError(
                        f"Polza.ai вернула HTTP {response.status_code}: {detail[:500]}"
                    )
                async for line in response.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    raw = line[5:].strip()
                    if raw == "[DONE]":
                        break
                    try:
                        event = json.loads(raw)
                    except json.JSONDecodeError:
                        continue
                    if isinstance(event.get("usage"), dict):
                        usage = _usage(event, model)
                    choices = event.get("choices") or []
                    if choices and isinstance(choices[0], dict):
                        delta = choices[0].get("delta", {}).get("content", "")
                        if isinstance(delta, str) and delta:
                            yield ProviderEvent(delta=delta)
        if usage is None:
            usage = Usage("polza", model)
        yield ProviderEvent(usage=usage)
