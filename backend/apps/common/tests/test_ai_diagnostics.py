import json
import os
import tempfile
from pathlib import Path

from apps.common.ai_diagnostics import (
    _HANDLER_MARKER,
    close_ai_diagnostics_handlers,
    log_ai_diagnostic,
)
from django.test import SimpleTestCase, override_settings


class AIDiagnosticsTests(SimpleTestCase):
    def tearDown(self):
        close_ai_diagnostics_handlers()
        super().tearDown()

    def test_disabled_diagnostics_do_not_create_files(self):
        with tempfile.TemporaryDirectory() as directory:
            with override_settings(
                AI_DIAGNOSTICS_ENABLED=False,
                AI_DIAGNOSTICS_DIRECTORY=directory,
            ):
                log_ai_diagnostic("test", content=b"personal data")
            self.assertEqual(list(Path(directory).iterdir()), [])

    def test_enabled_diagnostics_write_full_payload_and_redact_secrets(self):
        with tempfile.TemporaryDirectory() as directory:
            with override_settings(
                AI_DIAGNOSTICS_ENABLED=True,
                AI_DIAGNOSTICS_DIRECTORY=directory,
                AI_DIAGNOSTICS_RETENTION_DAYS=7,
            ):
                log_ai_diagnostic(
                    "test",
                    content=b"personal data",
                    message="Паспорт 1234 567890",
                    api_key="must-not-appear",  # pragma: allowlist secret
                    headers={"Authorization": "Bearer must-not-appear"},
                )
            log_path = Path(directory) / "ai-diagnostics.jsonl"
            record = json.loads(log_path.read_text(encoding="utf-8").strip())
            self.assertEqual(record["content"]["data"], "cGVyc29uYWwgZGF0YQ==")
            self.assertEqual(record["message"], "Паспорт 1234 567890")
            self.assertEqual(record["api_key"], "[REDACTED]")
            self.assertEqual(record["headers"]["Authorization"], "[REDACTED]")
            if os.name == "posix":
                self.assertEqual(oct(log_path.stat().st_mode & 0o777), "0o600")
                self.assertEqual(oct(Path(directory).stat().st_mode & 0o777), "0o700")
            close_ai_diagnostics_handlers()

    def test_retention_uses_six_backups_for_seven_days(self):
        with tempfile.TemporaryDirectory() as directory:
            directory_path = Path(directory)
            for index in range(8):
                backup = directory_path / f"ai-diagnostics.jsonl.2026-01-0{index + 1}"
                backup.write_text("{}\n", encoding="utf-8")
                os.utime(backup, (index + 1, index + 1))
            with override_settings(
                AI_DIAGNOSTICS_ENABLED=True,
                AI_DIAGNOSTICS_DIRECTORY=directory,
                AI_DIAGNOSTICS_RETENTION_DAYS=7,
            ):
                log_ai_diagnostic("test")
            import logging

            logger = logging.getLogger("ai_diagnostics")
            handler = next(
                item
                for item in logger.handlers
                if getattr(item, _HANDLER_MARKER, False)
            )
            self.assertEqual(handler.backupCount, 6)
            self.assertEqual(
                len(list(directory_path.glob("ai-diagnostics.jsonl.20*"))), 6
            )
            close_ai_diagnostics_handlers()
