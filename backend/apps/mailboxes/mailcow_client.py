import json
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any

from django.conf import settings


class MailcowError(RuntimeError):
    pass


def _format_mailcow_msg(message: Any) -> str:
    if isinstance(message, list):
        return ", ".join(str(part) for part in message)
    if isinstance(message, dict):
        return json.dumps(message, ensure_ascii=False)
    return str(message)


@dataclass(frozen=True)
class MailcowResponse:
    raw: Any

    def ensure_success(self) -> None:
        if not isinstance(self.raw, list):
            return
        for entry in self.raw:
            if not isinstance(entry, dict):
                continue
            entry_type = entry.get("type")
            if entry_type in {"danger", "error"}:
                raise MailcowError(_format_mailcow_msg(entry.get("msg", entry)))


class MailcowClient:
    def __init__(self) -> None:
        self.base_url = getattr(settings, "MAILCOW_API_URL", "").rstrip("/")
        self.api_key = getattr(settings, "MAILCOW_API_KEY", "")
        if not self.base_url:
            raise MailcowError("MAILCOW_API_URL is not configured.")
        if not self.api_key:
            raise MailcowError("MAILCOW_API_KEY is not configured.")

    def _request(self, path: str, payload: Any) -> MailcowResponse:
        url = f"{self.base_url}{path}"
        data = json.dumps(payload).encode("utf-8")
        request = urllib.request.Request(
            url=url,
            data=data,
            headers={
                "Content-Type": "application/json",
                "X-API-Key": self.api_key,
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                raw = response.read().decode("utf-8")
        except urllib.error.HTTPError as exc:
            detail = f"Mailcow API HTTP error: {exc.code}"
            try:
                error_raw = exc.read().decode("utf-8")
                parsed_error = json.loads(error_raw)
                if isinstance(parsed_error, dict):
                    msg = parsed_error.get("msg")
                    if msg:
                        detail = f"{detail} ({_format_mailcow_msg(msg)})"
                elif isinstance(parsed_error, list):
                    first = parsed_error[0] if parsed_error else None
                    if isinstance(first, dict) and first.get("msg"):
                        detail = f"{detail} ({_format_mailcow_msg(first.get('msg'))})"
            except Exception:
                pass
            raise MailcowError(detail) from exc
        except urllib.error.URLError as exc:
            raise MailcowError("Mailcow API request failed") from exc
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise MailcowError("Mailcow API returned invalid JSON") from exc
        return MailcowResponse(parsed)

    def ensure_domain(self, domain: str) -> None:
        payload = {
            "domain": domain,
            "description": "CRM domain",
            "active": True,
            "aliases": 200,
            "mailboxes": 200,
            "maxquota": 10240,
            "quota": 10240,
            "defquota": 3072,
            "restart_sogo": 1,
        }
        response = self._request("/add/domain", payload)
        response.ensure_success()

    def create_mailbox(
        self,
        domain: str,
        local_part: str,
        display_name: str,
        password: str,
        quota_mb: int = 3072,
    ) -> None:
        payload = {
            "active": True,
            "domain": domain,
            "local_part": local_part,
            "name": display_name or local_part,
            "password": password,
            "password2": password,
            "quota": max(1, int(quota_mb)),
        }
        response = self._request("/add/mailbox", payload)
        response.ensure_success()

    def delete_mailbox(self, email: str) -> None:
        payload = [email]
        response = self._request("/delete/mailbox", payload)
        response.ensure_success()
