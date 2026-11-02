import tempfile
import uuid
from unittest.mock import patch

from apps.documents.models import Document
from django.test import override_settings

from .test_tools import McpFixture


class FileReplayPermissionTests(McpFixture):
    def setUp(self):
        super().setUp()
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        settings = override_settings(MEDIA_ROOT=folder.name)
        settings.enable()
        self.addCleanup(settings.disable)
        self.download = patch(
            "apps.mcp_connector.files.download_chatgpt_file", return_value=b"private"
        ).start()
        self.addCleanup(patch.stopall)
        self.file = {
            "file_id": "file-one",
            "download_url": "https://files.oaiusercontent.com/test",
            "file_name": "private-client-passport.txt",
        }

    def upload(self, request_id):
        return self.write(
            "crm_upload_file",
            {
                "owner_type": "deal",
                "owner_id": str(self.deal.pk),
                "destination": "local",
                "file": self.file,
            },
            request_id,
        )

    def test_upload_replay_rechecks_deal_access(self):
        request_id = uuid.uuid4()
        first = self.upload(request_id)
        self.assertNotIn("error", first, first)
        self.assertTrue(self.upload(request_id)["replayed"])
        self.deal.seller = self.other
        self.deal.executor = self.other
        self.deal.save()
        replay = self.upload(request_id)
        self.assertIn(replay["error"]["status"], (403, 404))
        self.assertNotIn("name", replay)
        self.assertNotIn("id", replay)
        self.download.assert_called_once()

    def test_upload_replay_rechecks_current_file_membership(self):
        request_id = uuid.uuid4()
        first = self.upload(request_id)
        self.assertNotIn("error", first, first)
        Document.objects.filter(pk=first["id"][2:]).update(deal=self.foreign)
        replay = self.upload(request_id)
        self.assertEqual(replay["error"]["status"], 404)
        self.assertNotIn("name", replay)
        self.download.assert_called_once()

    def test_library_upload_replay_rechecks_manager_rights(self):
        self.user.is_staff = True
        self.user.save(update_fields=["is_staff"])
        request_id = uuid.uuid4()
        first = self.write("crm_upload_library_file", {"file": self.file}, request_id)
        self.assertIsNone(first.get("error"), first)
        self.assertTrue(
            self.write("crm_upload_library_file", {"file": self.file}, request_id)[
                "replayed"
            ]
        )
        self.user.is_staff = False
        self.user.save(update_fields=["is_staff"])
        replay = self.write("crm_upload_library_file", {"file": self.file}, request_id)
        self.assertEqual(replay["error"]["status"], 403)
        self.assertNotIn("id", replay)
        self.download.assert_called_once()
