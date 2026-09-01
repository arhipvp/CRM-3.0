import json
from io import StringIO
from unittest.mock import Mock, patch

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import SimpleTestCase, override_settings


class ExternalServiceChecksCommandTests(SimpleTestCase):
    @override_settings(
        AI_API_KEY="",
        GOOGLE_DRIVE_ROOT_FOLDER_ID="",
        TELEGRAM_BOT_TOKEN="",
        OPEN_NOTEBOOK_API_URL="",
        MAILCOW_API_URL="",
        MAILCOW_API_KEY="",
        MAILCOW_IMAP_HOST="",
    )
    def test_reports_missing_services_by_default(self):
        stdout = StringIO()

        call_command("check_external_services", stdout=stdout)

        output = stdout.getvalue()
        self.assertIn("[MISSING] ai_provider", output)
        self.assertIn("[MISSING] google_drive", output)
        self.assertIn("[MISSING] telegram_bot", output)
        self.assertIn("[MISSING] open_notebook", output)
        self.assertIn("[MISSING] mailcow_api", output)
        self.assertIn("[MISSING] mailcow_imap", output)

    @override_settings(
        AI_API_KEY="",
        GOOGLE_DRIVE_ROOT_FOLDER_ID="",
        TELEGRAM_BOT_TOKEN="",
        OPEN_NOTEBOOK_API_URL="",
        MAILCOW_API_URL="",
        MAILCOW_API_KEY="",
        MAILCOW_IMAP_HOST="",
    )
    def test_strict_mode_fails_when_service_is_missing(self):
        with self.assertRaises(CommandError):
            call_command("check_external_services", "--strict")

    @override_settings(
        AI_API_KEY="test-key",  # pragma: allowlist secret
        AI_BASE_URL="https://polza.ai/api/v1",
        AI_MODEL="demo-model",
        TELEGRAM_BOT_TOKEN="test-token",  # pragma: allowlist secret
        TELEGRAM_POLL_TIMEOUT=5,
        OPEN_NOTEBOOK_API_URL="https://notebook.example",
        OPEN_NOTEBOOK_PASSWORD="secret",  # pragma: allowlist secret
        MAILCOW_API_URL="https://mail.example/api/v1",
        MAILCOW_API_KEY="mailcow-key",  # pragma: allowlist secret
        MAILCOW_IMAP_HOST="imap.example",
        MAILCOW_IMAP_PORT=993,
    )
    def test_json_output_reports_healthy_services(self):
        stdout = StringIO()
        models_response = Mock()
        models_response.data = [Mock(id="demo-model")]

        with (
            patch(
                "apps.common.management.commands.check_external_services.get_drive_connection_status",
                return_value={
                    "status": "connected",
                    "auth_mode": "oauth",
                    "using_fallback": False,
                    "reconnect_available": True,
                    "last_checked_at": "2026-04-18T20:00:00Z",
                    "last_error_code": "",
                    "last_error_message": "",
                    "active_auth_type": "oauth",
                },
            ),
            patch(
                "apps.common.management.commands.check_external_services.openai.OpenAI",
                return_value=Mock(models=Mock(list=Mock(return_value=models_response))),
            ),
            patch(
                "apps.common.management.commands.check_external_services.TelegramClient.get_me",
                return_value={"username": "crm_bot"},
            ),
            patch(
                "apps.common.management.commands.check_external_services.OpenNotebookClient.get_notebooks",
                return_value=[{"id": "nb-1"}],
            ),
            patch(
                "apps.common.management.commands.check_external_services.urllib.request.urlopen"
            ) as urlopen_mock,
            patch(
                "apps.common.management.commands.check_external_services.imaplib.IMAP4_SSL"
            ) as imap_mock,
        ):
            urlopen_mock.return_value.__enter__.return_value.status = 200
            imap_instance = imap_mock.return_value
            imap_instance.capabilities = (b"IMAP4rev1", b"UIDPLUS")

            call_command("check_external_services", "--json", stdout=stdout)

        payload = json.loads(stdout.getvalue())
        statuses = {item["name"]: item["status"] for item in payload}
        self.assertEqual(statuses["ai_provider"], "ok")
        self.assertEqual(statuses["google_drive"], "ok")
        self.assertEqual(statuses["telegram_bot"], "ok")
        self.assertEqual(statuses["open_notebook"], "ok")
        self.assertEqual(statuses["mailcow_api"], "ok")
        self.assertEqual(statuses["mailcow_imap"], "ok")

    @override_settings(
        AI_API_KEY="test-key",  # pragma: allowlist secret
        AI_BASE_URL="https://polza.ai/api/v1",
        AI_MODEL="google/gemini-2.5-flash-lite",
    )
    @patch("apps.common.management.commands.check_external_services.openai.OpenAI")
    def test_ai_check_reports_error_when_configured_model_is_unavailable(
        self, openai_mock: Mock
    ):
        models_response = Mock()
        models_response.data = [Mock(id="another-model")]
        openai_mock.return_value = Mock(
            models=Mock(list=Mock(return_value=models_response))
        )

        stdout = StringIO()
        call_command("check_external_services", "--json", stdout=stdout)

        statuses = {item["name"]: item for item in json.loads(stdout.getvalue())}
        self.assertEqual(statuses["ai_provider"]["status"], "error")
        self.assertIn("was not returned by /models", statuses["ai_provider"]["detail"])
