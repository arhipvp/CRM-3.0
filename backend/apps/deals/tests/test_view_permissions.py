from datetime import date

from apps.clients.models import Client
from apps.deals.models import Deal
from apps.users.models import Role, UserRole
from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APIClient, APITestCase
from rest_framework_simplejwt.tokens import RefreshToken


class DealUpdatePermissionsTests(APITestCase):
    """Проверяет, что обновление сделки доступно продавцу и администратору."""

    def setUp(self):
        self.seller = User.objects.create_user(username="seller", password="pass")
        self.other_user = User.objects.create_user(username="other", password="pass")
        self.admin_user = User.objects.create_user(username="admin", password="pass")
        client = Client.objects.create(name="Client")
        self.deal = Deal.objects.create(
            title="Permission Deal",
            client=client,
            seller=self.seller,
            status="open",
            stage_name="initial",
        )

        admin_role, _ = Role.objects.get_or_create(
            name="Admin",
            defaults={"description": "Системный администратор"},
        )
        UserRole.objects.create(user=self.admin_user, role=admin_role)

        self.api_client = APIClient()
        self.seller_token = str(RefreshToken.for_user(self.seller).access_token)
        self.other_token = str(RefreshToken.for_user(self.other_user).access_token)
        self.admin_token = str(RefreshToken.for_user(self.admin_user).access_token)

    def _auth(self, token: str):
        self.api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    def _patch_expected_close(self, token: str, new_date: date):
        self._auth(token)
        return self.api_client.patch(
            f"/api/v1/deals/{self.deal.id}/",
            {"expected_close": new_date.isoformat()},
            format="json",
        )

    def test_seller_can_update_expected_close(self):
        response = self._patch_expected_close(self.seller_token, date(2025, 12, 31))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.deal.refresh_from_db()
        self.assertEqual(self.deal.expected_close, date(2025, 12, 31))

    def test_non_seller_cannot_update_deal(self):
        response = self._patch_expected_close(self.other_token, date(2025, 12, 31))

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.deal.refresh_from_db()
        self.assertIsNone(self.deal.expected_close)

    def test_admin_can_update_any_deal(self):
        response = self._patch_expected_close(self.admin_token, date(2025, 12, 31))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.deal.refresh_from_db()
        self.assertEqual(self.deal.expected_close, date(2025, 12, 31))
