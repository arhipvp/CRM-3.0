import json
import logging
import socket
import urllib.error
import urllib.request
from typing import Any
from urllib.parse import quote

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
            "allowed_updates": ["message", "callback_query"],
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

    def send_message(
        self, chat_id: int, text: str, reply_markup: dict[str, Any] | None = None
    ) -> bool:
        payload: dict[str, Any] = {"chat_id": chat_id, "text": text}
        if reply_markup:
            payload["reply_markup"] = reply_markup
        response = self._post("sendMessage", payload)
        if not response:
            return False
        if not response.get("ok"):
            logger.warning("Telegram sendMessage failed: %s", response)
            return False
        return True

    def answer_callback_query(self, callback_query_id: str, text: str = "") -> bool:
        payload = {"callback_query_id": callback_query_id}
        if text:
            payload["text"] = text
        response = self._post("answerCallbackQuery", payload)
        if not response:
            return False
        if not response.get("ok"):
            logger.warning("Telegram answerCallbackQuery failed: %s", response)
            return False
        return True

    def get_file(self, file_id: str) -> dict[str, Any] | None:
        response = self._post("getFile", {"file_id": file_id})
        if not response:
            return None
        if not response.get("ok"):
            logger.warning("Telegram getFile failed: %s", response)
            return None
        result = response.get("result")
        if isinstance(result, dict):
            return result
        return None

    def download_file(self, file_path: str) -> bytes | None:
        if not file_path:
            return None
        encoded_path = quote(file_path.lstrip("/"), safe="/")
        url = f"https://api.telegram.org/file/bot{self._token}/{encoded_path}"
        request = urllib.request.Request(url)
        try:
            with urllib.request.urlopen(request, timeout=self._timeout) as response:
                return response.read()
        except (socket.timeout, TimeoutError) as exc:
            logger.warning("Telegram file download timeout: %s", exc)
            return None
        except urllib.error.URLError as exc:
            logger.warning("Telegram file download failed: %s", exc)
            return None

    def _post(self, method: str, payload: dict[str, Any]) -> dict[str, Any] | None:
        url = f"{self._base_url}/{method}"
        data = json.dumps(payload).encode("utf-8")
        request = urllib.request.Request(
            url, data=data, headers={"Content-Type": "application/json"}
        )
        try:
            with urllib.request.urlopen(request, timeout=self._timeout) as response:
                return json.loads(response.read().decode("utf-8"))
        except (socket.timeout, TimeoutError) as exc:
            logger.warning("Telegram request timeout: %s", exc)
            return None
        except (urllib.error.URLError, json.JSONDecodeError) as exc:
            logger.warning("Telegram request failed: %s", exc)
            return None
