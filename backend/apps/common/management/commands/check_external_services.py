from __future__ import annotations

import imaplib
import json
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass
from typing import Callable

import openai
from apps.common.drive import get_drive_connection_status
from apps.documents.open_notebook import OpenNotebookClient
from apps.notifications.telegram_client import TelegramClient
from apps.policies.ai_service import _resolve_ai_client_config
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError


@dataclass
class CheckResult:
    name: str
    status: str
    detail: str


class Command(BaseCommand):
    help = "Check external integrations used by the local prod-like stack."

    def add_arguments(self, parser) -> None:
        parser.add_argument(
            "--json",
            action="store_true",
            help="Print machine-readable JSON instead of human-readable lines.",
        )
        parser.add_argument(
            "--strict",
            action="store_true",
            help="Exit non-zero when a service is missing configuration or unhealthy.",
        )

    def handle(self, *args, **options):
        results = [
            self._check_ai(),
            self._check_drive(),
            self._check_telegram(),
            self._check_open_notebook(),
            self._check_mailcow_api(),
            self._check_mailcow_imap(),
        ]

        if options["json"]:
            self.stdout.write(
                json.dumps([asdict(result) for result in results], ensure_ascii=False)
            )
        else:
            for result in results:
                self.stdout.write(
                    f"[{result.status.upper()}] {result.name}: {result.detail}"
                )

        failing_statuses = {"error", "missing"} if options["strict"] else set()

        if failing_statuses and any(
            result.status in failing_statuses for result in results
        ):
            raise CommandError("One or more external service checks failed.")

    def _run_check(self, name: str, probe: Callable[[], str]) -> CheckResult:
        try:
            detail = probe()
        except CommandError:
            raise
        except Exception as exc:  # noqa: BLE001
            return CheckResult(name=name, status="error", detail=str(exc))
        return CheckResult(name=name, status="ok", detail=detail)

    def _check_ai(self) -> CheckResult:
        if not getattr(settings, "OPENROUTER_API_KEY", "").strip():
            return CheckResult(
                name="ai_openrouter",
                status="missing",
                detail="OPENROUTER_API_KEY is not configured.",
            )

        def probe() -> str:
            api_key, base_url, model = _resolve_ai_client_config()
            client = openai.OpenAI(api_key=api_key, base_url=base_url)
            models = client.models.list()
            model_ids = [item.id for item in models.data if getattr(item, "id", "")]
            if model_ids and model not in model_ids:
                return (
                    f"Connected to {base_url}; configured model '{model}' was not "
                    f"returned by /models."
                )
            return f"Connected to {base_url}; model '{model}' is available."

        return self._run_check("ai_openrouter", probe)

    def _check_drive(self) -> CheckResult:
        status = get_drive_connection_status()
        if status["status"] == "connected":
            auth_type = (
                status.get("active_auth_type") or status.get("auth_mode") or "oauth"
            )
            return CheckResult(
                name="google_drive",
                status="ok",
                detail=f"Drive is connected via {auth_type}.",
            )
        if status["status"] == "not_configured":
            return CheckResult(
                name="google_drive",
                status="missing",
                detail=status["last_error_message"] or "Drive is not configured.",
            )
        return CheckResult(
            name="google_drive",
            status="error",
            detail=status["last_error_message"] or "Drive connection probe failed.",
        )

    def _check_telegram(self) -> CheckResult:
        token = getattr(settings, "TELEGRAM_BOT_TOKEN", "").strip()
        if not token:
            return CheckResult(
                name="telegram_bot",
                status="missing",
                detail="TELEGRAM_BOT_TOKEN is not configured.",
            )

        def probe() -> str:
            client = TelegramClient(
                token=token,
                timeout=int(getattr(settings, "TELEGRAM_POLL_TIMEOUT", 30)),
            )
            bot = client.get_me()
            if not bot:
                raise RuntimeError("Telegram getMe returned no bot information.")
            username = bot.get("username") or "<unknown>"
            return f"Bot token is valid for @{username}."

        return self._run_check("telegram_bot", probe)

    def _check_open_notebook(self) -> CheckResult:
        client = OpenNotebookClient()
        if not client.is_configured():
            return CheckResult(
                name="open_notebook",
                status="missing",
                detail="OPEN_NOTEBOOK_API_URL is not configured.",
            )

        def probe() -> str:
            notebooks = client.get_notebooks()
            return (
                "Open Notebook is reachable; "
                f"fetched {len(notebooks)} notebook entries."
            )

        return self._run_check("open_notebook", probe)

    def _check_mailcow_api(self) -> CheckResult:
        api_url = getattr(settings, "MAILCOW_API_URL", "").strip()
        api_key = getattr(settings, "MAILCOW_API_KEY", "").strip()
        if not api_url or not api_key:
            return CheckResult(
                name="mailcow_api",
                status="missing",
                detail="MAILCOW_API_URL and/or MAILCOW_API_KEY are not configured.",
            )

        def probe() -> str:
            request = urllib.request.Request(
                api_url,
                headers={"X-API-Key": api_key},
                method="GET",
            )
            try:
                with urllib.request.urlopen(request, timeout=20) as response:
                    return f"Mailcow API reachable with HTTP {response.status}."
            except urllib.error.HTTPError as exc:
                if exc.code in {400, 401, 403, 404, 405}:
                    return (
                        f"Mailcow API endpoint reachable; received expected probe "
                        f"HTTP {exc.code}."
                    )
                raise RuntimeError(f"Mailcow API HTTP error {exc.code}") from exc
            except urllib.error.URLError as exc:
                raise RuntimeError("Mailcow API request failed") from exc

        return self._run_check("mailcow_api", probe)

    def _check_mailcow_imap(self) -> CheckResult:
        host = getattr(settings, "MAILCOW_IMAP_HOST", "").strip()
        port = int(getattr(settings, "MAILCOW_IMAP_PORT", 993))
        if not host:
            return CheckResult(
                name="mailcow_imap",
                status="missing",
                detail="MAILCOW_IMAP_HOST is not configured.",
            )

        def probe() -> str:
            client = imaplib.IMAP4_SSL(host=host, port=port, timeout=20)
            try:
                capabilities = client.capabilities or ()
                capability_list = ", ".join(
                    sorted(
                        cap.decode() if isinstance(cap, bytes) else str(cap)
                        for cap in capabilities
                    )
                )
                return (
                    f"IMAP endpoint is reachable on {host}:{port} ({capability_list})."
                )
            finally:
                try:
                    client.logout()
                except Exception:  # noqa: BLE001
                    pass

        return self._run_check("mailcow_imap", probe)
