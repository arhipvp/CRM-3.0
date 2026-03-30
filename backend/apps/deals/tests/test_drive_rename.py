from __future__ import annotations

from unittest.mock import patch

from apps.clients.models import Client
from apps.common.tests.auth_utils import AuthenticatedAPITestCase
from apps.deals.models import Deal
from django.contrib.auth.models import User
from rest_framework import status


class DealDriveRenameTests(AuthenticatedAPITestCase):
    def setUp(self):
        super().setUp()
        self.seller = User.objects.create_user(
            username="seller-drive-rename", password="pass"
        )
        self.client_record = Client.objects.create(name="Client")
        self.deal = Deal.objects.create(
            title="Rename Deal",
            client=self.client_record,
            seller=self.seller,
            status="open",
            stage_name="initial",
        )
        self.token_for(self.seller)
        self.authenticate(self.seller)

    def test_renames_nested_file_from_deal_subfolder(self):
        Deal.objects.filter(pk=self.deal.pk).update(drive_folder_id="deal-folder")
        file_map = {
            "nested-file": {
                "id": "nested-file",
                "name": "before.pdf",
                "mime_type": "application/pdf",
                "is_folder": False,
                "parent_id": "subfolder-1",
            }
        }
        updated_file = {
            "id": "nested-file",
            "name": "after.pdf",
            "mime_type": "application/pdf",
            "is_folder": False,
            "parent_id": "subfolder-1",
        }

        with (
            patch(
                "apps.deals.view_mixins.drive.build_drive_file_tree_map",
                return_value=file_map,
            ) as tree_mock,
            patch(
                "apps.deals.view_mixins.drive.rename_drive_file",
                return_value=updated_file,
            ) as rename_mock,
        ):
            response = self.api_client.patch(
                f"/api/v1/deals/{self.deal.id}/drive-files/",
                {"file_id": "nested-file", "name": "after.pdf"},
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["file"]["name"], "after.pdf")
        tree_mock.assert_called_once_with("deal-folder")
        rename_mock.assert_called_once_with("nested-file", "after.pdf")
