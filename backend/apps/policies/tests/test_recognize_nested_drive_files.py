from __future__ import annotations

from unittest.mock import patch

from apps.clients.models import Client
from apps.common.tests.auth_utils import AuthenticatedAPITestCase
from apps.deals.models import Deal
from django.contrib.auth.models import User
from rest_framework import status


class PolicyRecognizeNestedDriveFilesTests(AuthenticatedAPITestCase):
    def setUp(self):
        super().setUp()
        self.seller = User.objects.create_user(  # pragma: allowlist secret
            username="seller-policy-recognition", password="pass"  # pragma: allowlist secret
        )
        self.client_record = Client.objects.create(name="Client")
        self.deal = Deal.objects.create(
            title="Policy Recognition Deal",
            client=self.client_record,
            seller=self.seller,
            status="open",
            stage_name="initial",
        )
        Deal.objects.filter(pk=self.deal.pk).update(drive_folder_id="deal-folder")
        self.token_for(self.seller)
        self.authenticate(self.seller)

    def test_recognize_uses_nested_drive_file(self):
        file_map = {
            "nested-file": {
                "id": "nested-file",
                "name": "policy.pdf",
                "mime_type": "application/pdf",
                "is_folder": False,
                "parent_id": "subfolder-1",
            }
        }

        with (
            patch(
                "apps.policies.views.build_drive_file_tree_map",
                return_value=file_map,
            ) as tree_mock,
            patch(
                "apps.policies.views.download_drive_file",
                return_value=b"policy-bytes",
            ),
            patch(
                "apps.policies.views.extract_text_from_bytes",
                return_value="policy text",
            ) as extract_mock,
            patch(
                "apps.policies.views.recognize_policy_from_text",
                return_value=({"policyNumber": "123"}, "transcript"),
            ) as recognize_mock,
        ):
            response = self.api_client.post(
                "/api/v1/policies/recognize/",
                {"deal_id": str(self.deal.id), "file_ids": ["nested-file"]},
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["results"][0]["status"], "parsed")
        self.assertEqual(response.data["results"][0]["data"]["policyNumber"], "123")
        tree_mock.assert_called_once_with("deal-folder")
        extract_mock.assert_called_once_with(b"policy-bytes", "policy.pdf")
        recognize_mock.assert_called_once()
