import json
from io import BytesIO
from types import SimpleNamespace
from unittest.mock import Mock, patch

from apps.common import drive
from apps.common.drive import (
    DRIVE_TEMPORARY_ERROR_CODE,
    DriveConfigurationError,
    DriveOperationError,
)
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
                    lambda service: (_ for _ in ()).throw(
                        _FakeHttpError(404, "notFound")
                    ),
                )

    def test_extract_refresh_error_details_marks_revoked_token(self):
        code, message = drive._extract_refresh_error_details(
            RefreshError("invalid_grant: Token has been expired or revoked.")
        )
        self.assertEqual(code, "oauth_refresh_revoked")
        self.assertIn("invalid_grant", message)

    def test_upload_file_to_drive_retries_temporary_http_error(self):
        upload_request = Mock()
        upload_request.next_chunk.side_effect = [
            _FakeHttpError(502, "backendError"),
            (
                None,
                {
                    "id": "file-1",
                    "name": "policy.pdf",
                    "mimeType": "application/pdf",
                    "size": "12",
                    "createdTime": "2026-07-03T10:00:00Z",
                    "modifiedTime": "2026-07-03T10:00:00Z",
                    "webViewLink": "https://drive/file-1",
                },
            ),
        ]
        media_upload = Mock(return_value="media-body")

        with (
            patch.object(drive, "_GDriveHttpError", _FakeHttpError),
            patch.object(drive, "_MediaIoBaseUpload", media_upload),
            patch.object(drive, "_run_with_drive_service", return_value=upload_request),
            patch.object(drive.time, "sleep") as sleep_mock,
        ):
            result = drive.upload_file_to_drive(
                "folder-1", BytesIO(b"pdf"), "policy.pdf", "application/pdf"
            )

        self.assertEqual(result["id"], "file-1")
        self.assertEqual(upload_request.next_chunk.call_count, 2)
        sleep_mock.assert_called_once_with(1)
        self.assertEqual(media_upload.call_args.kwargs["resumable"], True)
        self.assertEqual(
            media_upload.call_args.kwargs["chunksize"], drive.DRIVE_UPLOAD_CHUNK_SIZE
        )

    def test_upload_file_to_drive_raises_temporary_error_after_retries(self):
        upload_request = Mock()
        upload_request.next_chunk.side_effect = [
            _FakeHttpError(502, "backendError"),
            _FakeHttpError(502, "backendError"),
            _FakeHttpError(502, "backendError"),
            _FakeHttpError(502, "backendError"),
            _FakeHttpError(502, "backendError"),
        ]

        with (
            patch.object(drive, "_GDriveHttpError", _FakeHttpError),
            patch.object(drive, "_MediaIoBaseUpload", Mock(return_value="media-body")),
            patch.object(drive, "_run_with_drive_service", return_value=upload_request),
            patch.object(drive.time, "sleep") as sleep_mock,
        ):
            with self.assertRaises(DriveOperationError) as ctx:
                drive.upload_file_to_drive(
                    "folder-1", BytesIO(b"pdf"), "policy.pdf", "application/pdf"
                )

        self.assertEqual(ctx.exception.error_code, DRIVE_TEMPORARY_ERROR_CODE)
        self.assertTrue(ctx.exception.is_temporary)
        self.assertEqual(upload_request.next_chunk.call_count, 5)
        self.assertEqual(sleep_mock.call_count, len(drive.DRIVE_UPLOAD_RETRY_DELAYS))

    def test_upload_file_to_drive_does_not_retry_refresh_error(self):
        upload_request = Mock()
        upload_request.next_chunk.side_effect = RefreshError(
            "invalid_grant: Token has been expired or revoked."
        )

        with (
            patch.object(drive, "_MediaIoBaseUpload", Mock(return_value="media-body")),
            patch.object(drive, "_run_with_drive_service", return_value=upload_request),
            patch.object(drive.time, "sleep") as sleep_mock,
        ):
            with self.assertRaises(DriveOperationError) as ctx:
                drive.upload_file_to_drive(
                    "folder-1", BytesIO(b"pdf"), "policy.pdf", "application/pdf"
                )

        self.assertEqual(ctx.exception.error_code, drive.DRIVE_RECONNECT_REQUIRED_CODE)
        self.assertEqual(upload_request.next_chunk.call_count, 1)
        sleep_mock.assert_not_called()

    def test_upload_file_to_drive_does_not_retry_not_found(self):
        upload_request = Mock()
        upload_request.next_chunk.side_effect = _FakeHttpError(404, "notFound")

        with (
            patch.object(drive, "_GDriveHttpError", _FakeHttpError),
            patch.object(drive, "_MediaIoBaseUpload", Mock(return_value="media-body")),
            patch.object(drive, "_run_with_drive_service", return_value=upload_request),
            patch.object(drive.time, "sleep") as sleep_mock,
        ):
            with self.assertRaises(DriveOperationError):
                drive.upload_file_to_drive(
                    "folder-1", BytesIO(b"pdf"), "policy.pdf", "application/pdf"
                )

        self.assertEqual(upload_request.next_chunk.call_count, 1)
        sleep_mock.assert_not_called()

    def test_upload_file_to_drive_reads_resumable_chunks_until_done(self):
        upload_request = Mock()
        upload_request.next_chunk.side_effect = [
            (Mock(), None),
            (
                None,
                {
                    "id": "file-1",
                    "name": "policy.pdf",
                    "mimeType": "application/pdf",
                    "size": "12",
                    "createdTime": None,
                    "modifiedTime": None,
                    "webViewLink": None,
                },
            ),
        ]

        with (
            patch.object(drive, "_MediaIoBaseUpload", Mock(return_value="media-body")),
            patch.object(drive, "_run_with_drive_service", return_value=upload_request),
        ):
            result = drive.upload_file_to_drive(
                "folder-1", BytesIO(b"pdf"), "policy.pdf", "application/pdf"
            )

        self.assertEqual(result["id"], "file-1")
        self.assertEqual(upload_request.next_chunk.call_count, 2)
