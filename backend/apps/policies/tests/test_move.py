from decimal import Decimal
from unittest.mock import patch

from apps.clients.models import Client
from apps.common.drive import DriveOperationError
from apps.common.tests.auth_utils import AuthenticatedAPITestCase
from apps.deals.models import Deal
from apps.finances.models import FinancialRecord, Payment
from apps.policies.models import Policy
from django.contrib.auth.models import User
from rest_framework import status


class PolicyMoveTests(AuthenticatedAPITestCase):
    def setUp(self):
        super().setUp()
        self.seller = User.objects.create_user(username="policy-move-seller")
        self.other_user = User.objects.create_user(username="policy-move-other")
        self.client_obj = Client.objects.create(name="Move Client")
        self.source_deal = Deal.objects.create(
            title="Source Deal",
            client=self.client_obj,
            seller=self.seller,
            status="open",
            stage_name="initial",
        )
        self.target_deal = Deal.objects.create(
            title="Target Deal",
            client=self.client_obj,
            seller=self.seller,
            status="open",
            stage_name="initial",
        )
        self.policy = Policy.objects.create(
            number="MOVE-001",
            deal=self.source_deal,
            drive_folder_id="policy-folder",
        )
        self.payment = Payment.objects.create(
            policy=self.policy,
            deal=self.source_deal,
            amount=Decimal("1000.00"),
        )
        self.record = FinancialRecord.objects.create(
            payment=self.payment,
            amount=Decimal("100.00"),
        )

    def test_seller_moves_policy_payments_and_drive_folder(self):
        self.authenticate(self.seller)

        with (
            patch(
                "apps.policies.views.ensure_deal_folder",
                return_value="target-deal-folder",
            ) as ensure_deal_folder,
            patch("apps.policies.views.move_drive_folder_to_parent") as move_folder,
        ):
            response = self.api_client.post(
                f"/api/v1/policies/{self.policy.id}/move/",
                {"deal": str(self.target_deal.id)},
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.policy.refresh_from_db()
        self.payment.refresh_from_db()
        self.record.refresh_from_db()

        self.assertEqual(self.policy.deal_id, self.target_deal.id)
        self.assertEqual(self.payment.deal_id, self.target_deal.id)
        self.assertEqual(self.record.payment_id, self.payment.id)
        ensure_deal_folder.assert_called_once_with(self.target_deal)
        move_folder.assert_called_once_with("policy-folder", "target-deal-folder")

    def test_drive_failure_blocks_database_move(self):
        self.authenticate(self.seller)

        with patch(
            "apps.policies.views.ensure_deal_folder",
            side_effect=DriveOperationError("Drive unavailable"),
        ):
            response = self.api_client.post(
                f"/api/v1/policies/{self.policy.id}/move/",
                {"deal": str(self.target_deal.id)},
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.policy.refresh_from_db()
        self.payment.refresh_from_db()
        self.assertEqual(self.policy.deal_id, self.source_deal.id)
        self.assertEqual(self.payment.deal_id, self.source_deal.id)

    def test_non_source_seller_cannot_move_policy(self):
        self.authenticate(self.other_user)

        response = self.api_client.post(
            f"/api/v1/policies/{self.policy.id}/move/",
            {"deal": str(self.target_deal.id)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_cannot_move_policy_to_same_deal(self):
        self.authenticate(self.seller)

        response = self.api_client.post(
            f"/api/v1/policies/{self.policy.id}/move/",
            {"deal": str(self.source_deal.id)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
