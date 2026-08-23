from unittest.mock import patch

from apps.clients.models import Client
from apps.common.drive import DriveOperationError
from apps.common.tests.auth_utils import AuthenticatedAPITestCase
from apps.deals.models import Deal
from django.contrib.auth.models import User
from rest_framework import status


class DealDriveMoveTests(AuthenticatedAPITestCase):
    def setUp(self):
        super().setUp()
        self.seller = User.objects.create_user(
            username="seller-drive-move", password="pass"  # pragma: allowlist secret
        )
        self.executor = User.objects.create_user(
            username="executor-drive-move", password="pass"  # pragma: allowlist secret
        )
        self.client_record = Client.objects.create(name="Client")
        self.deal = Deal.objects.create(
            title="Move Deal",
            client=self.client_record,
            seller=self.seller,
            executor=self.executor,
            status="open",
            stage_name="initial",
            drive_folder_id="deal-folder",
        )
        self.token_for(self.seller)
        self.token_for(self.executor)

    def _url(self):
        return f"/api/v1/deals/{self.deal.id}/drive-files/move/"

    def test_seller_moves_files_to_nested_folder(self):
        self.authenticate(self.seller)

        with patch(
            "apps.deals.view_mixins.drive.move_drive_files_within_folder_tree",
            return_value=["file-1", "file-2"],
        ) as move_mock:
            response = self.api_client.post(
                self._url(),
                {"file_ids": ["file-1", "file-2"], "target_folder_id": "folder-1"},
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["moved_file_ids"], ["file-1", "file-2"])
        self.assertEqual(response.data["target_folder_id"], "folder-1")
        move_mock.assert_called_once_with(
            "deal-folder", ["file-1", "file-2"], "folder-1"
        )

    def test_seller_moves_nested_file_to_deal_root(self):
        self.authenticate(self.seller)

        with patch(
            "apps.deals.view_mixins.drive.move_drive_files_within_folder_tree",
            return_value=["nested-file"],
        ) as move_mock:
            response = self.api_client.post(
                self._url(),
                {"file_ids": ["nested-file"], "target_folder_id": "deal-folder"},
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        move_mock.assert_called_once_with("deal-folder", ["nested-file"], "deal-folder")

    def test_returns_validation_error_without_recovering_partial_moves(self):
        self.authenticate(self.seller)

        from apps.common.services import DriveFileMoveValidationError

        with patch(
            "apps.deals.view_mixins.drive.move_drive_files_within_folder_tree",
            side_effect=DriveFileMoveValidationError(
                "Можно перемещать только файлы.", folder_ids=["folder-1"]
            ),
        ):
            response = self.api_client.post(
                self._url(),
                {"file_ids": ["folder-1"], "target_folder_id": "folder-2"},
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["folder_ids"], ["folder-1"])

    def test_returns_drive_error(self):
        self.authenticate(self.seller)

        with patch(
            "apps.deals.view_mixins.drive.move_drive_files_within_folder_tree",
            side_effect=DriveOperationError("Drive unavailable"),
        ):
            response = self.api_client.post(
                self._url(),
                {"file_ids": ["file-1"], "target_folder_id": "folder-1"},
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)

    def test_executor_cannot_move_files(self):
        self.authenticate(self.executor)

        with patch(
            "apps.deals.view_mixins.drive.move_drive_files_within_folder_tree"
        ) as move_mock:
            response = self.api_client.post(
                self._url(),
                {"file_ids": ["file-1"], "target_folder_id": "folder-1"},
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        move_mock.assert_not_called()
