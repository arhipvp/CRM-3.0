from unittest.mock import MagicMock, patch

from apps.common import drive
from django.test import SimpleTestCase


class GuardedDriveMoveTests(SimpleTestCase):
    def setUp(self):
        self.expected = {
            "name": "Полис.pdf",
            "size": 123,
            "mime_type": "application/pdf",
            "checksum": "original-md5",
            "modified_at": "2026-10-25T10:00:00Z",
            "version": "1",
        }
        self.metadata = {
            "id": "original",
            "name": "Полис.pdf",
            "size": "123",
            "mimeType": "application/pdf",
            "md5Checksum": "original-md5",
            "modifiedTime": "2026-10-25T10:00:00Z",
            "version": "1",
            "parents": ["source"],
            "trashed": False,
        }
        self.service = MagicMock()
        self.service.files.return_value.get.return_value.execute.side_effect = (
            lambda: dict(self.metadata)
        )
        patcher = patch(
            "apps.common.drive._run_with_drive_service",
            side_effect=lambda operation, action: action(self.service),
        )
        patcher.start()
        self.addCleanup(patcher.stop)

    def move(self):
        drive.move_drive_item_between_folders(
            "original", "source", "target", expected_metadata=self.expected
        )

    def test_parent_change_in_inner_read_prevents_any_update(self):
        self.metadata["parents"] = ["foreign"]
        with self.assertRaises(drive.DriveOperationError):
            self.move()
        self.service.files.return_value.update.assert_not_called()

    def test_content_change_in_inner_read_prevents_any_update(self):
        self.metadata["md5Checksum"] = "changed"
        with self.assertRaises(drive.DriveOperationError):
            self.move()
        self.service.files.return_value.update.assert_not_called()

    def test_already_at_destination_checks_content_without_moving_again(self):
        self.metadata.update(parents=["target"], version="2", modifiedTime="later")
        self.move()
        self.service.files.return_value.update.assert_not_called()

    def test_guarded_update_removes_only_the_verified_source_parent(self):
        self.move()
        self.service.files.return_value.update.assert_called_once_with(
            fileId="original",
            addParents="target",
            removeParents="source",
            fields="id",
            supportsAllDrives=True,
        )

    def test_metadata_read_returns_checksum_and_parents_without_writes(self):
        result = drive.get_drive_file_metadata("original")
        self.assertEqual(result["checksum"], "original-md5")
        self.assertEqual(result["parents"], ["source"])
        self.assertEqual(result["size"], 123)
        self.service.files.return_value.update.assert_not_called()
