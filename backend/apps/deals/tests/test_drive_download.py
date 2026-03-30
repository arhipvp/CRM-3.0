from __future__ import annotations

from unittest.mock import patch

from apps.clients.models import Client
from apps.common.tests.auth_utils import AuthenticatedAPITestCase
from apps.deals.models import Deal
from django.contrib.auth.models import User
from rest_framework import status


class DealDriveDownloadTests(AuthenticatedAPITestCase):
    def setUp(self):
        super().setUp()
        self.seller = User.objects.create_user(  # pragma: allowlist secret
            username="seller-drive-download", password="pass"  # pragma: allowlist secret
        )
        self.client_record = Client.objects.create(name="Client")
        self.deal = Deal.objects.create(
            title="Download Deal",
            client=self.client_record,
            seller=self.seller,
            status="open",
            stage_name="initial",
        )
        self.token_for(self.seller)
        self.authenticate(self.seller)

    def test_downloads_nested_file_from_deal_subfolder(self):
        Deal.objects.filter(pk=self.deal.pk).update(drive_folder_id="deal-folder")
        file_map = {
            "nested-file": {
                "id": "nested-file",
                "name": "nested.pdf",
                "mime_type": "application/pdf",
                "is_folder": False,
                "parent_id": "subfolder-1",
            }
        }

        with (
            patch(
                "apps.deals.view_mixins.drive.build_drive_file_tree_map",
                return_value=file_map,
            ) as tree_mock,
            patch(
                "apps.deals.view_mixins.drive.download_drive_file",
                return_value=b"nested-pdf",
            ) as download_mock,
        ):
            response = self.api_client.post(
                f"/api/v1/deals/{self.deal.id}/drive-files/download/",
                {"file_ids": ["nested-file"]},
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.content, b"nested-pdf")
        self.assertIn("nested.pdf", response["Content-Disposition"])
        tree_mock.assert_called_once_with("deal-folder")
        download_mock.assert_called_once_with("nested-file")
