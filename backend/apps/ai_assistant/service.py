from __future__ import annotations

from collections.abc import Iterator
from typing import Any

import httpx
from django.conf import settings


class AssistantServiceError(Exception):
    def __init__(self, message: str, status_code: int = 502) -> None:
        super().__init__(message)
        self.status_code = status_code


class AssistantServiceNotFound(AssistantServiceError):
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
                method,
                self._url(path),
                headers=self.headers,
                timeout=self.timeout,
                **kwargs,
            )
        except httpx.HTTPError as exc:
            raise AssistantServiceError(
                "Страховой помощник временно недоступен."
            ) from exc
        if response.status_code >= 400:
            detail = response.text.strip() or "Страховой помощник вернул ошибку."
            raise AssistantServiceError(detail, response.status_code)
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
                    raise AssistantServiceError(
                        response.read().decode("utf-8", "replace"), response.status_code
                    )
                yield from response.iter_bytes()
        except httpx.HTTPError as exc:
            raise AssistantServiceError(
                "Страховой помощник временно недоступен."
            ) from exc

    def download(self, path: str) -> tuple[dict[str, str], Iterator[bytes]]:
        client = httpx.Client(timeout=self.timeout)
        try:
            response = client.send(
                client.build_request("GET", self._url(path), headers=self.headers),
                stream=True,
            )
        except httpx.HTTPError as exc:
            client.close()
            raise AssistantServiceError(
                "Страховой помощник временно недоступен."
            ) from exc
        if response.status_code >= 400:
            detail = response.read().decode("utf-8", "replace").strip()
            response.close()
            client.close()
            if response.status_code == 404:
                raise AssistantServiceNotFound(detail or "Документ не найден.")
            raise AssistantServiceError(
                detail or "Документ не найден.", response.status_code
            )

        headers = {
            "Content-Type": response.headers.get(
                "Content-Type", "application/octet-stream"
            ),
            "Content-Disposition": response.headers.get(
                "Content-Disposition", "inline"
            ),
        }

        def content() -> Iterator[bytes]:
            try:
                yield from response.iter_bytes()
            finally:
                response.close()
                client.close()

        return headers, content()
