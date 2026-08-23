from unittest.mock import call, patch

from apps.common.services import (
    DriveFileMoveValidationError,
    move_drive_files_within_folder_tree,
)
from django.test import SimpleTestCase


class MoveDriveFilesWithinFolderTreeTests(SimpleTestCase):
    def setUp(self):
        self.file_map = {
            "root-file": {
                "id": "root-file",
                "is_folder": False,
                "parent_id": "root",
            },
            "nested-file": {
                "id": "nested-file",
                "is_folder": False,
                "parent_id": "folder-a",
            },
            "folder-a": {"id": "folder-a", "is_folder": True, "parent_id": "root"},
            "folder-b": {"id": "folder-b", "is_folder": True, "parent_id": "root"},
        }

    @patch("apps.common.services.move_drive_item_between_folders")
    @patch("apps.common.services.build_drive_file_tree_map")
    def test_moves_multiple_files_using_each_files_parent(self, tree_mock, move_mock):
        tree_mock.return_value = self.file_map

        moved = move_drive_files_within_folder_tree(
            "root", ["root-file", "nested-file"], "folder-b"
        )

        self.assertEqual(moved, ["root-file", "nested-file"])
        move_mock.assert_has_calls(
            [
                call("root-file", "root", "folder-b"),
                call("nested-file", "folder-a", "folder-b"),
            ]
        )

    @patch("apps.common.services.move_drive_item_between_folders")
    @patch("apps.common.services.build_drive_file_tree_map")
    def test_moves_nested_file_to_root(self, tree_mock, move_mock):
        tree_mock.return_value = self.file_map

        move_drive_files_within_folder_tree("root", ["nested-file"], "root")

        move_mock.assert_called_once_with("nested-file", "folder-a", "root")

    @patch("apps.common.services.move_drive_item_between_folders")
    @patch("apps.common.services.build_drive_file_tree_map")
    def test_rejects_invalid_requests_before_moving(self, tree_mock, move_mock):
        tree_mock.return_value = self.file_map

        cases = (
            (["missing"], "folder-a"),
            (["folder-a"], "folder-b"),
            (["root-file"], "root-file"),
            (["root-file", "root-file"], "folder-a"),
            (["root-file"], "root"),
            (["root"], "folder-a"),
        )
        for file_ids, target_folder_id in cases:
            with self.subTest(file_ids=file_ids, target_folder_id=target_folder_id):
                with self.assertRaises(DriveFileMoveValidationError):
                    move_drive_files_within_folder_tree(
                        "root", file_ids, target_folder_id
                    )

        move_mock.assert_not_called()
