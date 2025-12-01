from apps.clients.models import Client
from apps.deals.models import Deal
from apps.users.models import Role, UserRole
from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken


class DealCloseReopenTests(APITestCase):
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

        self.seller_token = str(RefreshToken.for_user(self.seller).access_token)
        self.other_token = str(RefreshToken.for_user(self.other).access_token)
        self.admin_token = str(RefreshToken.for_user(self.admin).access_token)

    def _auth(self, token: str):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    def test_seller_can_close_deal_with_reason(self):
        self._auth(self.seller_token)
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
        self._auth(self.seller_token)
        response = self.client.post(
            f"/api/v1/deals/{self.deal.id}/close/",
            {"reason": ""},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("reason", response.data)

    def test_other_user_cannot_close(self):
        self._auth(self.other_token)
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
        self._auth(self.seller_token)
        response = self.client.post(f"/api/v1/deals/{self.deal.id}/reopen/", format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.deal.refresh_from_db()
        self.assertEqual(self.deal.status, "open")
        self.assertEqual(self.deal.closing_reason, "")

    def test_non_owner_cannot_reopen(self):
        self.deal.status = "won"
        self.deal.closing_reason = "Won reason"
        self.deal.save()
        self._auth(self.other_token)
        response = self.client.post(f"/api/v1/deals/{self.deal.id}/reopen/", format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_reopen(self):
        self.deal.status = "lost"
        self.deal.closing_reason = "Lost reason"
        self.deal.save()
        self._auth(self.admin_token)
        response = self.client.post(f"/api/v1/deals/{self.deal.id}/reopen/", format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.deal.refresh_from_db()
        self.assertEqual(self.deal.status, "open")
        self.assertEqual(self.deal.closing_reason, "")
