import json
import logging
import urllib.error
import urllib.request
from typing import Any

logger = logging.getLogger(__name__)


class TelegramClient:
    def __init__(self, token: str, timeout: int = 30) -> None:
        self._token = token
        self._timeout = timeout
        self._base_url = f"https://api.telegram.org/bot{token}"

    def get_updates(
        self, offset: int | None = None, timeout: int | None = None
    ) -> list[dict[str, Any]]:
        payload: dict[str, Any] = {
            "timeout": timeout or self._timeout,
            "allowed_updates": ["message"],
        }
        if offset is not None:
            payload["offset"] = offset
        response = self._post("getUpdates", payload)
        if not response:
            return []
        if not response.get("ok"):
            logger.warning("Telegram getUpdates failed: %s", response)
            return []
        return response.get("result", [])

    def send_message(self, chat_id: int, text: str) -> bool:
        payload = {"chat_id": chat_id, "text": text}
        response = self._post("sendMessage", payload)
        if not response:
            return False
        if not response.get("ok"):
            logger.warning("Telegram sendMessage failed: %s", response)
            return False
        return True

    def _post(self, method: str, payload: dict[str, Any]) -> dict[str, Any] | None:
        url = f"{self._base_url}/{method}"
        data = json.dumps(payload).encode("utf-8")
        request = urllib.request.Request(
            url, data=data, headers={"Content-Type": "application/json"}
        )
        try:
            with urllib.request.urlopen(request, timeout=self._timeout) as response:
                return json.loads(response.read().decode("utf-8"))
        except (urllib.error.URLError, json.JSONDecodeError) as exc:
            logger.warning("Telegram request failed: %s", exc)
            return None
