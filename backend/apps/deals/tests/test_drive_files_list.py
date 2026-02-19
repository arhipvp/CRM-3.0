from __future__ import annotations

from unittest.mock import patch

from apps.clients.models import Client
from apps.common.tests.auth_utils import AuthenticatedAPITestCase
from apps.deals.models import Deal
from django.contrib.auth.models import User
from rest_framework import status


class DealDriveFilesListTests(AuthenticatedAPITestCase):
    def setUp(self):
        super().setUp()
        self.seller = User.objects.create_user(
            username="seller-drive-list", password="pass"
        )
        self.client_record = Client.objects.create(name="Client")
        self.deal = Deal.objects.create(
            title="Drive list deal",
            client=self.client_record,
            seller=self.seller,
            status="open",
            stage_name="initial",
        )
        self.token_for(self.seller)
        self.authenticate(self.seller)

    def test_get_returns_root_files_without_parent_id(self):
        Deal.objects.filter(pk=self.deal.pk).update(drive_folder_id="deal-folder")
        root_files = [{"id": "file-1", "name": "a.pdf", "is_folder": False}]

        with (
            patch(
                "apps.deals.view_mixins.drive.ensure_deal_folder",
                return_value="deal-folder",
            ) as ensure_folder_mock,
            patch(
                "apps.deals.view_mixins.drive.list_drive_folder_contents",
                return_value=root_files,
            ) as list_contents_mock,
        ):
            response = self.api_client.get(f"/api/v1/deals/{self.deal.id}/drive-files/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["folder_id"], "deal-folder")
        self.assertEqual(response.data["files"], root_files)
        ensure_folder_mock.assert_called_once()
        list_contents_mock.assert_called_once_with("deal-folder")

    def test_get_returns_folder_children_when_parent_id_is_valid(self):
        Deal.objects.filter(pk=self.deal.pk).update(drive_folder_id="deal-folder")
        root_items = [
            {"id": "nested-folder", "name": "folder", "is_folder": True},
            {"id": "root-file", "name": "root.pdf", "is_folder": False},
        ]
        nested_items = [{"id": "nested-file", "name": "nested.pdf", "is_folder": False}]

        def list_side_effect(folder_id: str):
            if folder_id == "deal-folder":
                return root_items
            if folder_id == "nested-folder":
                return nested_items
            return []

        with (
            patch(
                "apps.deals.view_mixins.drive.ensure_deal_folder",
                return_value="deal-folder",
            ),
            patch(
                "apps.deals.view_mixins.drive.list_drive_folder_contents",
                side_effect=list_side_effect,
            ) as list_contents_mock,
        ):
            response = self.api_client.get(
                f"/api/v1/deals/{self.deal.id}/drive-files/?parent_id=nested-folder"
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["folder_id"], "deal-folder")
        self.assertEqual(response.data["files"], nested_items)
        self.assertEqual(list_contents_mock.call_count, 2)
        list_contents_mock.assert_any_call("deal-folder")
        list_contents_mock.assert_any_call("nested-folder")

    def test_get_returns_400_for_parent_id_outside_deal_tree(self):
        Deal.objects.filter(pk=self.deal.pk).update(drive_folder_id="deal-folder")

        with (
            patch(
                "apps.deals.view_mixins.drive.ensure_deal_folder",
                return_value="deal-folder",
            ),
            patch(
                "apps.deals.view_mixins.drive.list_drive_folder_contents",
                return_value=[],
            ) as list_contents_mock,
        ):
            response = self.api_client.get(
                f"/api/v1/deals/{self.deal.id}/drive-files/?parent_id=foreign-folder"
            )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            response.data["detail"],
            "Указанная папка не принадлежит дереву папок сделки.",
        )
        list_contents_mock.assert_called_once_with("deal-folder")
