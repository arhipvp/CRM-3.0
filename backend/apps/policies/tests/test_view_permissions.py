# -*- coding: cp866 -*-
from apps.clients.models import Client
from apps.deals.models import Deal, InsuranceCompany, InsuranceType
from apps.policies.models import Policy
from apps.users.models import Role, UserRole
from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APIClient, APITestCase
from rest_framework_simplejwt.tokens import RefreshToken


class PolicyCreationPermissionsTests(APITestCase):
    """Проверяет, что полисы может добавлять только продавец сделки."""

    def setUp(self):
        self.seller = User.objects.create_user(username="seller", password="pass")
        self.other_user = User.objects.create_user(username="other", password="pass")
        self.admin_user = User.objects.create_user(username="admin", password="pass")
        client = Client.objects.create(name="Client Test")
        self.deal = Deal.objects.create(
            title="Policy Deal",
            client=client,
            seller=self.seller,
            status="open",
            stage_name="initial",
        )

        self.insurance_company = InsuranceCompany.objects.create(
            name="Test Insurance Company",
            description="Company for tests",
        )
        self.insurance_type = InsuranceType.objects.create(
            name="Test Insurance Type",
            description="Type for tests",
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

    def _policy_payload(self, number: str) -> dict:
        return {
            "number": number,
            "deal": self.deal.id,
            "insurance_company": self.insurance_company.id,
            "insurance_type": self.insurance_type.id,
        }

    def _post_policy(self, token: str, number: str):
        self._auth(token)
        return self.api_client.post(
            "/api/v1/policies/",
            self._policy_payload(number),
            format="json",
        )

    def test_seller_can_create_policy(self):
        number = "POLICY-SELLER-001"
        response = self._post_policy(self.seller_token, number)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Policy.objects.filter(number=number, deal=self.deal).exists())

    def test_non_seller_cannot_create_policy(self):
        number = "POLICY-OTHER-001"
        response = self._post_policy(self.other_token, number)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(Policy.objects.filter(number=number).exists())

    def test_admin_cannot_create_policy(self):
        number = "POLICY-ADMIN-001"
        response = self._post_policy(self.admin_token, number)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(Policy.objects.filter(number=number).exists())
