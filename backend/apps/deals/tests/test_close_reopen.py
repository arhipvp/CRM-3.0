from apps.clients.models import Client
from apps.common.tests.auth_utils import AuthenticatedAPITestCase
from apps.deals.models import Deal
from apps.finances.models import FinancialRecord, Payment
from apps.policies.models import Policy
from apps.users.models import Role, UserRole
from django.contrib.auth.models import User
from rest_framework import status


class DealCloseReopenTests(AuthenticatedAPITestCase):
    def setUp(self):
        self.seller = User.objects.create_user(username="seller", password="pass")
        self.other = User.objects.create_user(username="other", password="pass")
        self.admin = User.objects.create_user(username="admin", password="pass")
        client_obj = Client.objects.create(name="Client")
        self.deal = Deal.objects.create(
            title="Closeable Deal",
            client=client_obj,
            seller=self.seller,
            status="open",
            stage_name="initial",
        )

        seller_role, _ = Role.objects.get_or_create(name="Seller")
        admin_role, _ = Role.objects.get_or_create(name="Admin")
        UserRole.objects.create(user=self.seller, role=seller_role)
        UserRole.objects.create(user=self.admin, role=admin_role)

        self.token_for(self.seller)
        self.token_for(self.other)
        self.token_for(self.admin)

    def test_seller_can_close_deal_with_reason(self):
        self.authenticate(self.seller)
        response = self.client.post(
            f"/api/v1/deals/{self.deal.id}/close/",
            {"reason": "Deal completed"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.deal.refresh_from_db()
        self.assertEqual(self.deal.status, "won")
        self.assertEqual(self.deal.closing_reason, "Deal completed")

    def test_close_requires_reason(self):
        self.authenticate(self.seller)
        response = self.client.post(
            f"/api/v1/deals/{self.deal.id}/close/",
            {"reason": ""},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("reason", response.data)

    def test_other_user_cannot_close(self):
        self.authenticate(self.other)
        response = self.client.post(
            f"/api/v1/deals/{self.deal.id}/close/",
            {"reason": "Not mine"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_seller_can_reopen_closed_deal(self):
        self.deal.status = "lost"
        self.deal.closing_reason = "Lost reason"
        self.deal.save()
        self.authenticate(self.seller)
        response = self.client.post(
            f"/api/v1/deals/{self.deal.id}/reopen/", format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.deal.refresh_from_db()
        self.assertEqual(self.deal.status, "open")
        self.assertEqual(self.deal.closing_reason, "")

    def test_non_owner_cannot_reopen(self):
        self.deal.status = "won"
        self.deal.closing_reason = "Won reason"
        self.deal.save()
        self.authenticate(self.other)
        response = self.client.post(
            f"/api/v1/deals/{self.deal.id}/reopen/", format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_reopen(self):
        self.deal.status = "lost"
        self.deal.closing_reason = "Lost reason"
        self.deal.save()
        self.authenticate(self.admin)
        response = self.client.post(
            f"/api/v1/deals/{self.deal.id}/reopen/", format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.deal.refresh_from_db()
        self.assertEqual(self.deal.status, "open")
        self.assertEqual(self.deal.closing_reason, "")

    def test_closed_deals_hidden_without_flag_and_shown_with_flag(self):
        closed_deal = Deal.objects.create(
            title="Archived Deal",
            client=self.deal.client,
            seller=self.seller,
            status="won",
            stage_name="final",
        )
        self.authenticate(self.admin)
        response = self.client.get("/api/v1/deals/", format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = {entry["id"] for entry in response.data.get("results", [])}
        self.assertIn(str(self.deal.id), ids)
        self.assertNotIn(str(closed_deal.id), ids)

        response = self.client.get(
            "/api/v1/deals/", {"show_closed": "1"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = {entry["id"] for entry in response.data.get("results", [])}
        self.assertIn(str(closed_deal.id), ids)

    def test_closing_deal_keeps_policies_and_finance_records_intact(self):
        policy = Policy.objects.create(deal=self.deal, number="POL-123")
        payment = Payment.objects.create(
            policy=policy, deal=self.deal, amount=250.0, description="Premium"
        )
        FinancialRecord.objects.create(
            payment=payment, amount=250.0, description="Income"
        )

        self.authenticate(self.seller)
        response = self.client.post(
            f"/api/v1/deals/{self.deal.id}/close/",
            {"reason": "Won"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        policy.refresh_from_db()
        payment.refresh_from_db()
        record = FinancialRecord.objects.get(payment=payment)
        self.assertIsNone(policy.deleted_at)
        self.assertIsNone(payment.deleted_at)
        self.assertIsNone(record.deleted_at)
