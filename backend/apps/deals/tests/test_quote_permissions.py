from apps.clients.models import Client
from apps.deals.models import Deal, InsuranceCompany, InsuranceType, Quote
from apps.users.models import Role, UserRole
from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APIClient, APITestCase
from rest_framework_simplejwt.tokens import RefreshToken


class QuoteDeletionPermissionsTests(APITestCase):
    """Убедиться, что расчет могут удалить только создатель, продавец сделки или админ."""

    def setUp(self):
        self.creator = User.objects.create_user(username="creator", password="pass")
        self.deal_seller = User.objects.create_user(username="seller", password="pass")
        self.other_user = User.objects.create_user(username="other", password="pass")
        self.admin = User.objects.create_user(username="admin", password="pass")

        client = Client.objects.create(name="Quote Client")
        self.deal = Deal.objects.create(
            title="Quote Deal",
            client=client,
            seller=self.deal_seller,
            status="open",
            stage_name="initial",
        )
        self.insurance_company = InsuranceCompany.objects.create(name="Acme Co")
        self.insurance_type = InsuranceType.objects.create(name="Auto")
        self.quote = Quote.objects.create(
            deal=self.deal,
            seller=self.creator,
            insurance_company=self.insurance_company,
            insurance_type=self.insurance_type,
            sum_insured=1000,
            premium=50,
        )

        admin_role = Role.objects.create(name="Admin")
        UserRole.objects.create(user=self.admin, role=admin_role)

        self.api_client = APIClient()
        self.creator_token = str(RefreshToken.for_user(self.creator).access_token)
        self.seller_token = str(RefreshToken.for_user(self.deal_seller).access_token)
        self.admin_token = str(RefreshToken.for_user(self.admin).access_token)
        self.other_token = str(RefreshToken.for_user(self.other_user).access_token)

    def _delete_quote(self, token: str):
        self.api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        return self.api_client.delete(f"/api/v1/quotes/{self.quote.id}/")

    def _quote_with_deleted(self):
        return Quote.objects.with_deleted().get(id=self.quote.id)

    def test_creator_can_delete_quote(self):
        response = self._delete_quote(self.creator_token)

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertIsNotNone(self._quote_with_deleted().deleted_at)

    def test_deal_seller_can_delete_quote(self):
        response = self._delete_quote(self.seller_token)

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertIsNotNone(self._quote_with_deleted().deleted_at)

    def test_admin_can_delete_quote(self):
        response = self._delete_quote(self.admin_token)

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertIsNotNone(self._quote_with_deleted().deleted_at)

    def test_other_user_cannot_delete_quote(self):
        response = self._delete_quote(self.other_token)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIsNone(Quote.objects.get(id=self.quote.id).deleted_at)
