from __future__ import annotations

from unittest.mock import call, patch

from apps.clients.models import Client
from apps.common.tests.auth_utils import AuthenticatedAPITestCase
from apps.deals.models import Deal
from django.contrib.auth.models import User
from rest_framework import status


class DealDriveTrashTests(AuthenticatedAPITestCase):
    def setUp(self):
        super().setUp()
        self.seller = User.objects.create_user(  # pragma: allowlist secret
            username="seller-trash", password="pass"  # pragma: allowlist secret
        )
        self.other_user = User.objects.create_user(
            username="other-trash", password="pass"  # pragma: allowlist secret
        )
        self.client_record = Client.objects.create(name="Client")
        self.deal = Deal.objects.create(
            title="Trash Deal",
            client=self.client_record,
            seller=self.seller,
            status="open",
            stage_name="initial",
        )

        self.token_for(self.seller)
        self.token_for(self.other_user)

    def test_seller_can_trash_multiple_files(self):
        self.authenticate(self.seller)

        Deal.objects.filter(pk=self.deal.pk).update(drive_folder_id="deal-folder")

        drive_files = [
            {"id": "file-1", "is_folder": False},
            {"id": "file-2", "is_folder": False},
            {"id": "folder-1", "is_folder": True},
        ]

        with (
            patch(
                "apps.deals.view_mixins.drive.ensure_deal_folder",
                return_value="deal-folder",
            ) as ensure_deal_folder_mock,
            patch(
                "apps.deals.view_mixins.drive.build_drive_file_tree_map",
                return_value={item["id"]: item for item in drive_files},
            ) as tree_mock,
            patch(
                "apps.deals.view_mixins.drive.ensure_trash_folder",
                return_value="trash-folder",
            ) as ensure_trash_mock,
            patch(
                "apps.deals.view_mixins.drive.move_drive_file_to_folder"
            ) as move_mock,
        ):
            response = self.api_client.delete(
                f"/api/v1/deals/{self.deal.id}/drive-files/",
                {"file_ids": ["file-1", "file-2"]},
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["moved_file_ids"], ["file-1", "file-2"])
        self.assertEqual(response.data["trash_folder_id"], "trash-folder")

        ensure_deal_folder_mock.assert_not_called()
        tree_mock.assert_called_once_with("deal-folder")
        ensure_trash_mock.assert_called_once_with("deal-folder")
        move_mock.assert_has_calls(
            [call("file-1", "trash-folder"), call("file-2", "trash-folder")],
            any_order=False,
        )

    def test_returns_400_when_file_missing_in_deal_folder(self):
        self.authenticate(self.seller)

        Deal.objects.filter(pk=self.deal.pk).update(drive_folder_id="deal-folder")

        drive_files = [{"id": "file-1", "is_folder": False}]

        with (
            patch(
                "apps.deals.view_mixins.drive.ensure_deal_folder",
                return_value="deal-folder",
            ),
            patch(
                "apps.deals.view_mixins.drive.build_drive_file_tree_map",
                return_value={item["id"]: item for item in drive_files},
            ),
            patch(
                "apps.deals.view_mixins.drive.ensure_trash_folder"
            ) as ensure_trash_mock,
            patch(
                "apps.deals.view_mixins.drive.move_drive_file_to_folder"
            ) as move_mock,
        ):
            response = self.api_client.delete(
                f"/api/v1/deals/{self.deal.id}/drive-files/",
                {"file_ids": ["file-1", "missing-file"]},
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("missing_file_ids", response.data)
        self.assertEqual(response.data["missing_file_ids"], ["missing-file"])
        ensure_trash_mock.assert_not_called()
        move_mock.assert_not_called()

    def test_seller_can_trash_nested_file(self):
        self.authenticate(self.seller)

        Deal.objects.filter(pk=self.deal.pk).update(drive_folder_id="deal-folder")
        file_map = {
            "nested-file": {
                "id": "nested-file",
                "is_folder": False,
                "parent_id": "nested-folder",
            }
        }

        with (
            patch(
                "apps.deals.view_mixins.drive.build_drive_file_tree_map",
                return_value=file_map,
            ) as tree_mock,
            patch(
                "apps.deals.view_mixins.drive.ensure_trash_folder",
                return_value="trash-folder",
            ) as ensure_trash_mock,
            patch(
                "apps.deals.view_mixins.drive.move_drive_file_to_folder"
            ) as move_mock,
        ):
            response = self.api_client.delete(
                f"/api/v1/deals/{self.deal.id}/drive-files/",
                {"file_ids": ["nested-file"]},
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["moved_file_ids"], ["nested-file"])
        tree_mock.assert_called_once_with("deal-folder")
        ensure_trash_mock.assert_called_once_with("deal-folder")
        move_mock.assert_called_once_with("nested-file", "trash-folder")

    def test_seller_can_trash_file_for_closed_deal_when_show_closed_flag_is_set(self):
        self.authenticate(self.seller)

        Deal.objects.filter(pk=self.deal.pk).update(
            drive_folder_id="deal-folder",
            status=Deal.DealStatus.WON,
        )
        file_map = {
            "closed-file": {
                "id": "closed-file",
                "is_folder": False,
                "parent_id": None,
            }
        }

        with (
            patch(
                "apps.deals.view_mixins.drive.build_drive_file_tree_map",
                return_value=file_map,
            ) as tree_mock,
            patch(
                "apps.deals.view_mixins.drive.ensure_trash_folder",
                return_value="trash-folder",
            ) as ensure_trash_mock,
            patch(
                "apps.deals.view_mixins.drive.move_drive_file_to_folder"
            ) as move_mock,
        ):
            response = self.api_client.delete(
                f"/api/v1/deals/{self.deal.id}/drive-files/?show_closed=1",
                {"file_ids": ["closed-file"]},
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["moved_file_ids"], ["closed-file"])
        tree_mock.assert_called_once_with("deal-folder")
        ensure_trash_mock.assert_called_once_with("deal-folder")
        move_mock.assert_called_once_with("closed-file", "trash-folder")

    def test_other_user_cannot_trash_files(self):
        self.authenticate(self.other_user)

        with (
            patch(
                "apps.deals.view_mixins.drive.ensure_deal_folder"
            ) as ensure_deal_folder_mock,
            patch(
                "apps.deals.view_mixins.drive.build_drive_file_tree_map"
            ) as tree_mock,
        ):
            response = self.api_client.delete(
                f"/api/v1/deals/{self.deal.id}/drive-files/",
                {"file_ids": ["file-1"]},
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        ensure_deal_folder_mock.assert_not_called()
        tree_mock.assert_not_called()
