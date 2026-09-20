from __future__ import annotations

from collections.abc import Iterator
from typing import Any

import httpx
from django.conf import settings


class AssistantServiceError(Exception):
    pass


class AssistantService:
    def __init__(self, user_id: int) -> None:
        self.headers = {
            "X-Insurance-Assistant-Token": settings.INSURANCE_ASSISTANT_INTERNAL_TOKEN,
            "X-CRM-User-Id": str(user_id),
        }
        self.base_url = settings.INSURANCE_ASSISTANT_URL.rstrip("/")
        self.timeout = settings.INSURANCE_ASSISTANT_TIMEOUT_SECONDS

    def _url(self, path: str) -> str:
        return f"{self.base_url}{path}"

    def request(self, method: str, path: str, **kwargs: Any) -> Any:
        try:
            response = httpx.request(
                method, self._url(path), headers=self.headers, timeout=self.timeout, **kwargs
            )
        except httpx.HTTPError as exc:
            raise AssistantServiceError("Страховой помощник временно недоступен.") from exc
        if response.status_code >= 400:
            detail = response.text.strip() or "Страховой помощник вернул ошибку."
            raise AssistantServiceError(detail)
        if response.status_code == 204:
            return None
        return response.json()

    def stream(self, path: str, payload: dict[str, Any]) -> Iterator[bytes]:
        try:
            with httpx.stream(
                "POST",
                self._url(path),
                headers={**self.headers, "Accept": "text/event-stream"},
                json=payload,
                timeout=self.timeout,
            ) as response:
                if response.status_code >= 400:
                    raise AssistantServiceError(response.read().decode("utf-8", "replace"))
                yield from response.iter_bytes()
        except httpx.HTTPError as exc:
            raise AssistantServiceError("Страховой помощник временно недоступен.") from exc
