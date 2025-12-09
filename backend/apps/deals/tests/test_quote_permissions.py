from apps.clients.models import Client
from apps.common.tests.auth_utils import AuthenticatedAPITestCase
from apps.deals.models import Deal, InsuranceCompany, InsuranceType, Quote
from apps.users.models import Role, UserRole
from django.contrib.auth.models import User
from rest_framework import status


class QuoteDeletionPermissionsTests(AuthenticatedAPITestCase):
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

        self.token_for(self.creator)
        self.token_for(self.deal_seller)
        self.token_for(self.admin)
        self.token_for(self.other_user)

    def _delete_quote(self, user: User):
        self.authenticate(user)
        return self.api_client.delete(f"/api/v1/quotes/{self.quote.id}/")

    def _quote_with_deleted(self):
        return Quote.objects.with_deleted().get(id=self.quote.id)

    def test_creator_can_delete_quote(self):
        response = self._delete_quote(self.creator)

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertIsNotNone(self._quote_with_deleted().deleted_at)

    def test_deal_seller_can_delete_quote(self):
        response = self._delete_quote(self.deal_seller)

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertIsNotNone(self._quote_with_deleted().deleted_at)

    def test_admin_can_delete_quote(self):
        response = self._delete_quote(self.admin)

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertIsNotNone(self._quote_with_deleted().deleted_at)

    def test_other_user_cannot_delete_quote(self):
        response = self._delete_quote(self.other_user)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIsNone(Quote.objects.get(id=self.quote.id).deleted_at)
