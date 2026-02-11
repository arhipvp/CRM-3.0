import json
from types import SimpleNamespace
from unittest.mock import Mock, patch

from apps.common import drive
from apps.common.drive import DriveConfigurationError
from django.test import SimpleTestCase, override_settings


class _FakeHttpError(Exception):
    def __init__(self, status: int, reason: str):
        self.resp = SimpleNamespace(status=status)
        self.content = json.dumps(
            {"error": {"errors": [{"reason": reason}], "message": reason}}
        ).encode("utf-8")
        super().__init__(f"http {status}: {reason}")


class DriveAuthTests(SimpleTestCase):
    @override_settings(
        GOOGLE_DRIVE_AUTH_MODE="auto",
        GOOGLE_DRIVE_OAUTH_CLIENT_ID="client-id",
        GOOGLE_DRIVE_OAUTH_CLIENT_SECRET="client-secret",
        GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN="refresh-token",
        GOOGLE_DRIVE_OAUTH_TOKEN_URI="https://oauth2.googleapis.com/token",
        GOOGLE_DRIVE_SERVICE_ACCOUNT_FILE="/tmp/service-account.json",
    )
    def test_auto_mode_retries_with_service_account_on_oauth_404(self):
        gdrive_build = Mock(side_effect=["oauth-service", "sa-service"])
        oauth_module = SimpleNamespace(Credentials=Mock(return_value="oauth-creds"))
        service_account_module = SimpleNamespace(
            Credentials=SimpleNamespace(
                from_service_account_file=Mock(return_value="sa-creds")
            )
        )

        with (
            patch.object(drive, "_drive_import_error", None),
            patch.object(drive, "_gdrive_build", gdrive_build),
            patch.object(drive, "_oauth_credentials", oauth_module),
            patch.object(drive, "_service_account", service_account_module),
            patch.object(drive, "_GDriveHttpError", _FakeHttpError),
        ):

            def _operation(service):
                if service == "sa-service":
                    return "legacy-result"
                raise _FakeHttpError(404, "notFound")

            result = drive._run_with_drive_service(
                "test_operation",
                _operation,
            )

        self.assertEqual(result, "legacy-result")
        self.assertEqual(gdrive_build.call_count, 2)
        self.assertEqual(
            gdrive_build.call_args_list[0].kwargs["credentials"], "oauth-creds"
        )
        self.assertEqual(
            gdrive_build.call_args_list[1].kwargs["credentials"], "sa-creds"
        )

    @override_settings(
        GOOGLE_DRIVE_AUTH_MODE="auto",
        GOOGLE_DRIVE_OAUTH_CLIENT_ID="client-id",
        GOOGLE_DRIVE_OAUTH_CLIENT_SECRET="",
        GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN="",
        GOOGLE_DRIVE_SERVICE_ACCOUNT_FILE="",
    )
    def test_auto_mode_rejects_partial_oauth_configuration(self):
        with (
            patch.object(drive, "_drive_import_error", None),
            patch.object(drive, "_gdrive_build", Mock(return_value="unused")),
            patch.object(
                drive,
                "_oauth_credentials",
                SimpleNamespace(Credentials=Mock(return_value="oauth-creds")),
            ),
            patch.object(drive, "_service_account", Mock()),
        ):
            with self.assertRaisesMessage(
                DriveConfigurationError,
                "Google Drive OAuth settings are partially configured.",
            ):
                drive._get_drive_services()

    @override_settings(
        GOOGLE_DRIVE_AUTH_MODE="oauth",
        GOOGLE_DRIVE_OAUTH_CLIENT_ID="",
        GOOGLE_DRIVE_OAUTH_CLIENT_SECRET="",
        GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN="",
        GOOGLE_DRIVE_SERVICE_ACCOUNT_FILE="/tmp/service-account.json",
    )
    def test_oauth_mode_requires_oauth_credentials(self):
        with (
            patch.object(drive, "_drive_import_error", None),
            patch.object(drive, "_gdrive_build", Mock(return_value="unused")),
            patch.object(
                drive,
                "_oauth_credentials",
                SimpleNamespace(Credentials=Mock(return_value="oauth-creds")),
            ),
            patch.object(
                drive,
                "_service_account",
                SimpleNamespace(
                    Credentials=SimpleNamespace(
                        from_service_account_file=Mock(return_value="sa-creds")
                    )
                ),
            ),
        ):
            with self.assertRaisesMessage(
                DriveConfigurationError,
                "OAuth mode is enabled but OAuth credentials are not configured.",
            ):
                drive._get_drive_services()
