import tempfile
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from urllib.parse import urlsplit

import fitz
from apps.clients.models import Client
from apps.deals.models import Deal
from apps.documents.models import Document
from apps.mcp_connector import files
from apps.mcp_connector.contracts import SCOPES, Principal
from apps.users.models import AuditLog
from django.contrib.auth import get_user_model
from django.core import signing
from django.core.files.base import ContentFile
from django.http import Http404
from django.test import RequestFactory, SimpleTestCase, TestCase, override_settings
from rest_framework.exceptions import AuthenticationFailed, NotFound, ValidationError


class FileDownloadSafetyTests(SimpleTestCase):
    def test_only_approved_https_hosts_are_accepted(self):
        for url in (
            "http://files.oaiusercontent.com/document",
            "https://files.oaiusercontent.com.evil.example/document",
            "https://127.0.0.1/document",
            "https://user:password@files.oaiusercontent.com/document",
            "https://files.oaiusercontent.com:8443/document",
            "https://files.oaiusercontent.com:bad/document",
        ):
            with self.subTest(url=url), self.assertRaises(ValidationError):
                files._validate_download_url(url)

    def test_dns_results_with_any_private_address_are_rejected(self):
        records = [
            (2, 1, 6, "", ("93.184.216.34", 443)),
            (2, 1, 6, "", ("127.0.0.1", 443)),
        ]
        with patch.object(
            files.socket, "getaddrinfo", return_value=records
        ), self.assertRaises(ValidationError):
            files._validate_download_url("https://files.oaiusercontent.com/document")

    @patch.object(files.urllib3, "HTTPSConnectionPool")
    def test_download_pins_ip_and_verifies_original_tls_hostname(self, pool_class):
        response = MagicMock(status=200, headers={"Content-Length": "3"})
        response.stream.return_value = [b"PDF"]
        pool_class.return_value.urlopen.return_value = response
        parsed = urlsplit("https://files.oaiusercontent.com/file?signature=private")
        with patch.object(
            files,
            "_validate_download_url",
            return_value=(parsed, parsed.hostname, "93.184.216.34"),
        ):
            self.assertEqual(
                files.download_chatgpt_file(
                    {"file_id": "file-one", "download_url": parsed.geturl()}
                ),
                b"PDF",
            )
        args, kwargs = pool_class.call_args
        self.assertEqual(args[0], "93.184.216.34")
        self.assertEqual(kwargs["server_hostname"], "files.oaiusercontent.com")
        self.assertEqual(kwargs["assert_hostname"], "files.oaiusercontent.com")
        self.assertEqual(kwargs["cert_reqs"], "CERT_REQUIRED")
        self.assertFalse(pool_class.return_value.urlopen.call_args.kwargs["redirect"])

    @patch.object(files.urllib3, "HTTPSConnectionPool")
    def test_streamed_body_limit_is_enforced_without_content_length(self, pool_class):
        response = MagicMock(status=200, headers={})
        response.stream.return_value = [b"1234", b"5678"]
        pool_class.return_value.urlopen.return_value = response
        parsed = urlsplit("https://files.oaiusercontent.com/file")
        with (
            patch.object(
                files,
                "_validate_download_url",
                return_value=(parsed, parsed.hostname, "93.184.216.34"),
            ),
            patch.object(files, "MAX_FILE_BYTES", 5),
            self.assertRaises(ValidationError),
        ):
            files.download_chatgpt_file(
                {"file_id": "file-one", "download_url": parsed.geturl()}
            )

    @patch.object(files.urllib3, "HTTPSConnectionPool")
    def test_redirect_is_revalidated_before_next_connection(self, pool_class):
        response = MagicMock(
            status=302,
            headers={"Location": "https://169.254.169.254/latest/meta-data/"},
        )
        pool_class.return_value.urlopen.return_value = response
        records = [(2, 1, 6, "", ("93.184.216.34", 443))]
        with patch.object(
            files.socket, "getaddrinfo", return_value=records
        ), self.assertRaises(ValidationError):
            files.download_chatgpt_file(
                {
                    "file_id": "file-one",
                    "download_url": "https://files.oaiusercontent.com/file",
                }
            )
        self.assertEqual(pool_class.call_count, 1)

    def test_filename_cannot_contain_a_path(self):
        for name in ("../passport.pdf", "a\\passport.pdf", ".", ""):
            with self.subTest(name=name), self.assertRaises(ValidationError):
                files._filename(name)
        self.assertEqual(files._filename("Паспорт клиента.pdf"), "Паспорт_клиента.pdf")

    def test_pdf_page_range_and_text_continuation(self):
        with fitz.open() as document:
            for word in ("First", "Second", "Third"):
                document.new_page().insert_text((72, 72), word)
            content = document.tobytes()
        pages, count = files._text_pages(
            content, "document.pdf", "application/pdf", 2, 1, False
        )
        self.assertEqual(count, 3)
        self.assertEqual(len(pages), 1)
        self.assertEqual(pages[0]["page"], 2)
        self.assertIn("Second", pages[0]["text"])

    def test_selected_page_text_is_bounded_with_continuation(self):
        entry = {"id": "l_test", "name": "test.txt", "mime_type": "text/plain"}
        with patch.object(files, "_load_file", return_value=(entry, b"a" * 250)):
            result = files.read_file_text(
                {
                    "owner_type": "deal",
                    "owner_id": "test",
                    "file_id": "l_test",
                    "max_chars": 100,
                },
                None,
            )
        self.assertEqual(len(result["pages"][0]["text"]), 100)
        self.assertEqual(result["next_page"], 1)
        self.assertEqual(result["next_text_offset"], 100)

    def test_large_image_is_rejected_before_ocr(self):
        image = SimpleNamespace(width=6000, height=6000)
        with self.assertRaises(ValidationError):
            files._ocr(image)

    def test_signed_download_rejects_tampering_and_expiry(self):
        ticket = signing.dumps({"user_id": 1}, salt=files.DOWNLOAD_SALT)
        request = RequestFactory().get("/")
        with self.assertRaises(Http404):
            files.file_download_view(request, ticket + "tampered")
        with patch.object(
            files.signing, "loads", side_effect=signing.SignatureExpired()
        ), self.assertRaises(Http404):
            files.file_download_view(request, ticket)


class FileOwnerPermissionTests(TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.override = override_settings(MEDIA_ROOT=self.directory.name)
        self.override.enable()
        self.addCleanup(self.override.disable)
        self.access = patch.object(
            files, "_check_access", side_effect=lambda principal, **kwargs: principal
        )
        self.access.start()
        self.addCleanup(self.access.stop)
        self.user = get_user_model().objects.create_user("file-owner")
        self.other = get_user_model().objects.create_user("other-owner")
        self.client = Client.objects.create(name="Клиент", created_by=self.user)
        self.deal = Deal.objects.create(
            title="Сделка", client=self.client, seller=self.user
        )
        self.foreign_deal = Deal.objects.create(
            title="Чужая сделка", client=self.client, seller=self.other
        )
        self.principal = Principal(self.user, "chatgpt-test", frozenset(SCOPES))
        self.document = Document(
            title="Паспорт.txt", deal=self.deal, owner=self.user, mime_type="text/plain"
        )
        self.document.file.save(
            "passport.txt", ContentFile("Проверка UTF-8".encode("utf-8"))
        )

    def args(self, **overrides):
        return {
            "owner_type": "document",
            "owner_id": str(self.document.pk),
            "file_id": f"l_{self.document.pk}",
            **overrides,
        }

    def test_read_own_document_has_no_database_or_drive_writes(self):
        before = AuditLog.objects.count()
        with patch.object(files.drive, "ensure_deal_folder") as ensure:
            result = files.read_file_text(self.args(), self.principal)
        self.assertEqual(result["pages"][0]["text"], "Проверка UTF-8")
        self.assertEqual(AuditLog.objects.count(), before)
        ensure.assert_not_called()

    def test_another_users_document_is_inaccessible(self):
        other = Principal(self.other, "chatgpt-test", frozenset(SCOPES))
        with self.assertRaises(Http404):
            files._load_file(self.args(), other)

    def test_file_id_cannot_be_substituted_under_another_deal(self):
        with patch.object(files, "_catalog", return_value=[]), self.assertRaises(
            NotFound
        ):
            files._load_file(
                self.args(
                    owner_type="deal", owner_id=str(self.deal.pk), file_id="l_foreign"
                ),
                self.principal,
            )

    def test_empty_drive_folder_is_read_without_ensure(self):
        with patch.object(files.drive, "ensure_client_folder") as ensure, patch.object(
            files.drive, "list_drive_folder_contents"
        ) as listing:
            result = files.list_files(
                {"owner_type": "client", "owner_id": str(self.client.pk)},
                self.principal,
            )
        self.assertEqual(result["results"], [])
        ensure.assert_not_called()
        listing.assert_not_called()

    def test_denied_upload_does_not_download_or_create_folder(self):
        with patch.object(files, "download_chatgpt_file") as download, patch.object(
            files.drive, "ensure_deal_folder"
        ) as ensure, self.assertRaises(Http404):
            files.upload_file(
                {
                    "owner_type": "deal",
                    "owner_id": str(self.foreign_deal.pk),
                    "file": {
                        "file_id": "one",
                        "download_url": "https://files.oaiusercontent.com/file",
                    },
                },
                self.principal,
            )
        download.assert_not_called()
        ensure.assert_not_called()

    def test_local_upload_records_real_author_and_channel(self):
        with patch.object(files, "download_chatgpt_file", return_value=b"hello"):
            result = files.upload_file(
                {
                    "owner_type": "deal",
                    "owner_id": str(self.deal.pk),
                    "destination": "local",
                    "file": {
                        "file_id": "one",
                        "download_url": "https://files.oaiusercontent.com/file",
                        "file_name": "source.txt",
                    },
                },
                self.principal,
            )
        uploaded = Document.objects.get(pk=result["id"][2:])
        self.assertEqual(uploaded.owner_id, self.user.pk)
        audit = AuditLog.objects.filter(
            object_id=str(uploaded.pk), description="ChatGPT: upload local file"
        ).get()
        self.assertEqual(audit.actor_id, self.user.pk)
        self.assertEqual(audit.new_value["channel"], "ChatGPT")

    def test_drive_preview_is_pure_and_rejects_foreign_destination(self):
        self.deal.drive_folder_id = "root"
        self.deal.save(update_fields=["drive_folder_id"])
        item = {
            "id": "one",
            "name": "one.pdf",
            "mime_type": "application/pdf",
            "size": 10,
            "is_folder": False,
            "parent_id": "root",
            "modified_at": "2026-10-25",
        }
        args = {
            "owner_type": "deal",
            "owner_id": str(self.deal.pk),
            "file_id": files._drive_file_id("one"),
            "name": "new.pdf",
        }
        with patch.object(files, "_tree", return_value={"one": item}), patch.object(
            files.drive, "rename_drive_file"
        ) as rename, patch.object(files.drive, "ensure_trash_folder") as ensure:
            plan = files._mutation_plan(args, self.principal, "rename")[3]
        self.assertEqual(plan["changes"]["new_name"], "new.pdf")
        rename.assert_not_called()
        ensure.assert_not_called()
        with patch.object(
            files, "_tree", return_value={"one": item}
        ), self.assertRaises(Exception) as caught:
            files._mutation_plan(
                dict(args, target_folder_id=files._drive_file_id("foreign")),
                self.principal,
                "move",
            )
        self.assertEqual(caught.exception.status_code, 403)

    def test_download_capability_rechecks_revocation(self):
        ticket = signing.dumps(
            {
                "user_id": self.user.pk,
                "client_id": "chatgpt-test",
                "token_id": 1,
                "scopes": list(SCOPES),
                **self.args(),
            },
            salt=files.DOWNLOAD_SALT,
        )
        with patch.object(
            files, "_check_access", side_effect=AuthenticationFailed("revoked")
        ), self.assertRaises(Http404):
            files.file_download_view(RequestFactory().get("/"), ticket)

    def test_original_download_capability_is_limited_to_one_file(self):
        principal = Principal(self.user, "chatgpt-test", frozenset(SCOPES), token_id=7)
        result = files.get_file_download(self.args(), principal)
        link = result.content[0]
        ticket = urlsplit(str(link.uri)).path.split("/")[-2]
        payload = signing.loads(ticket, salt=files.DOWNLOAD_SALT, max_age=600)
        self.assertEqual(payload["file_id"], f"l_{self.document.pk}")
        self.assertEqual(payload["token_id"], 7)
        self.assertEqual(payload["user_id"], self.user.pk)
        response = files.file_download_view(RequestFactory().get("/"), ticket)
        try:
            self.assertEqual(
                b"".join(response.streaming_content), "Проверка UTF-8".encode("utf-8")
            )
            self.assertEqual(response["Cache-Control"], "private, no-store")
            self.assertEqual(response["X-Content-Type-Options"], "nosniff")
        finally:
            response.close()
