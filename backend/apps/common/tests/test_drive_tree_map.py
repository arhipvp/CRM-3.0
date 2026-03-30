from unittest.mock import patch

from apps.common.drive import build_drive_file_tree_map
from django.test import SimpleTestCase


class DriveTreeMapTests(SimpleTestCase):
    def test_build_drive_file_tree_map_recurses_into_subfolders(self):
        root_items = [
            {
                "id": "folder-1",
                "name": "Folder",
                "is_folder": True,
                "parent_id": "root",
            },
            {
                "id": "root-file",
                "name": "root.pdf",
                "is_folder": False,
                "parent_id": "root",
            },
        ]
        nested_items = [
            {
                "id": "nested-file",
                "name": "nested.pdf",
                "is_folder": False,
                "parent_id": "folder-1",
            }
        ]

        def list_side_effect(folder_id: str):
            if folder_id == "root":
                return root_items
            if folder_id == "folder-1":
                return nested_items
            return []

        with patch(
            "apps.common.drive.list_drive_folder_contents",
            side_effect=list_side_effect,
        ) as list_mock:
            file_map = build_drive_file_tree_map("root")

        self.assertEqual(
            set(file_map.keys()),
            {"folder-1", "root-file", "nested-file"},
        )
        self.assertEqual(file_map["nested-file"]["parent_id"], "folder-1")
        self.assertEqual(list_mock.call_count, 2)
