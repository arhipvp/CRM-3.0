import json
from types import SimpleNamespace
from unittest.mock import Mock, patch

from apps.common import drive
from apps.common.drive import DriveConfigurationError
from django.test import SimpleTestCase, override_settings
from google.auth.exceptions import RefreshError


class _FakeHttpError(Exception):
    def __init__(self, status: int, reason: str):
        self.resp = SimpleNamespace(status=status)
        self.content = json.dumps(
            {"error": {"errors": [{"reason": reason}], "message": reason}}
        ).encode("utf-8")
        super().__init__(f"http {status}: {reason}")


class DriveAuthTests(SimpleTestCase):
    @override_settings(
        GOOGLE_DRIVE_OAUTH_CLIENT_ID="client-id",
        GOOGLE_DRIVE_OAUTH_CLIENT_SECRET="client-secret",  # pragma: allowlist secret
        GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN="refresh-token",
        GOOGLE_DRIVE_OAUTH_TOKEN_URI="https://oauth2.googleapis.com/token",
    )
    def test_get_drive_services_returns_oauth_service(self):
        gdrive_build = Mock(return_value="oauth-service")
        oauth_module = SimpleNamespace(Credentials=Mock(return_value="oauth-creds"))

        with (
            patch.object(drive, "_drive_import_error", None),
            patch.object(drive, "_gdrive_build", gdrive_build),
            patch.object(drive, "_oauth_credentials", oauth_module),
        ):
            services = drive._get_drive_services()

        self.assertEqual(services, [(drive.DRIVE_AUTH_MODE_OAUTH, "oauth-service")])
        self.assertEqual(gdrive_build.call_count, 1)
        self.assertEqual(gdrive_build.call_args.kwargs["credentials"], "oauth-creds")

    @override_settings(
        GOOGLE_DRIVE_OAUTH_CLIENT_ID="client-id",
        GOOGLE_DRIVE_OAUTH_CLIENT_SECRET="",
        GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN="",
    )
    def test_rejects_partial_oauth_configuration(self):
        with (
            patch.object(drive, "_drive_import_error", None),
            patch.object(drive, "_gdrive_build", Mock(return_value="unused")),
            patch.object(
                drive,
                "_oauth_credentials",
                SimpleNamespace(Credentials=Mock(return_value="oauth-creds")),
            ),
        ):
            with self.assertRaisesMessage(
                DriveConfigurationError,
                "Google Drive OAuth settings are partially configured.",
            ):
                drive._get_drive_services()

    @override_settings(
        GOOGLE_DRIVE_OAUTH_CLIENT_ID="",
        GOOGLE_DRIVE_OAUTH_CLIENT_SECRET="",
        GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN="",
    )
    def test_requires_oauth_credentials(self):
        with (
            patch.object(drive, "_drive_import_error", None),
            patch.object(drive, "_gdrive_build", Mock(return_value="unused")),
            patch.object(
                drive,
                "_oauth_credentials",
                SimpleNamespace(Credentials=Mock(return_value="oauth-creds")),
            ),
        ):
            with self.assertRaisesMessage(
                DriveConfigurationError,
                "Google Drive OAuth credentials are not configured.",
            ):
                drive._get_drive_services()

    @override_settings(
        GOOGLE_DRIVE_OAUTH_CLIENT_ID="client-id",
        GOOGLE_DRIVE_OAUTH_CLIENT_SECRET="client-secret",  # pragma: allowlist secret
        GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN="refresh-token",
    )
    def test_run_with_drive_service_does_not_fallback_on_http_error(self):
        gdrive_build = Mock(return_value="oauth-service")
        oauth_module = SimpleNamespace(Credentials=Mock(return_value="oauth-creds"))

        with (
            patch.object(drive, "_drive_import_error", None),
            patch.object(drive, "_gdrive_build", gdrive_build),
            patch.object(drive, "_oauth_credentials", oauth_module),
            patch.object(drive, "_GDriveHttpError", _FakeHttpError),
        ):
            with self.assertRaises(_FakeHttpError):
                drive._run_with_drive_service(
                    "test_operation",
                    lambda service: (_ for _ in ()).throw(_FakeHttpError(404, "notFound")),
                )

    def test_extract_refresh_error_details_marks_revoked_token(self):
        code, message = drive._extract_refresh_error_details(
            RefreshError("invalid_grant: Token has been expired or revoked.")
        )
        self.assertEqual(code, "oauth_refresh_revoked")
        self.assertIn("invalid_grant", message)
