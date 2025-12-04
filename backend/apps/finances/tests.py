from decimal import Decimal

from apps.clients.models import Client
from apps.deals.models import Deal
from apps.finances.models import FinancialRecord, Payment
from apps.users.models import Role, UserRole
from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APIClient, APITestCase
from rest_framework_simplejwt.tokens import RefreshToken


class FinanceAccessTests(APITestCase):
    """Проверяем доступ покупателей к платежам и финансовым записям сделок."""

    def setUp(self):
        self.seller = User.objects.create_user(username="seller", password="pass")
        self.executor = User.objects.create_user(username="executor", password="pass")
        self.other_user = User.objects.create_user(username="other", password="pass")
        self.admin_user = User.objects.create_user(username="admin", password="pass")

        client = Client.objects.create(name="Client")
        self.deal = Deal.objects.create(
            title="Permission Deal",
            client=client,
            seller=self.seller,
            executor=self.executor,
            status="open",
            stage_name="initial",
        )

        admin_role, _ = Role.objects.get_or_create(
            name="Admin", defaults={"description": "Системный администратор"}
        )
        UserRole.objects.create(user=self.admin_user, role=admin_role)

        self.payment = Payment.objects.create(
            deal=self.deal, amount=Decimal("1000.00"), description="Initial"
        )
        self.fin_record = FinancialRecord.objects.create(
            payment=self.payment, amount=Decimal("100"), description="Calc"
        )

        self.api_client = APIClient()
        self.seller_token = str(RefreshToken.for_user(self.seller).access_token)
        self.executor_token = str(RefreshToken.for_user(self.executor).access_token)
        self.other_token = str(RefreshToken.for_user(self.other_user).access_token)
        self.admin_token = str(RefreshToken.for_user(self.admin_user).access_token)

    def _auth(self, token: str):
        self.api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    def test_seller_can_create_payment(self):
        self._auth(self.seller_token)
        response = self.api_client.post(
            "/api/v1/payments/",
            {
                "amount": "1500.00",
                "deal": str(self.deal.id),
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_executor_can_create_payment(self):
        self._auth(self.executor_token)
        response = self.api_client.post(
            "/api/v1/payments/",
            {
                "amount": "2000.00",
                "deal": str(self.deal.id),
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_other_user_cannot_create_payment(self):
        self._auth(self.other_token)
        response = self.api_client.post(
            "/api/v1/payments/",
            {
                "amount": "2000.00",
                "deal": str(self.deal.id),
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_seller_can_create_financial_record(self):
        self._auth(self.seller_token)
        response = self.api_client.post(
            "/api/v1/financial_records/",
            {
                "payment": str(self.payment.id),
                "amount": "50.00",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_executor_can_create_financial_record(self):
        self._auth(self.executor_token)
        response = self.api_client.post(
            "/api/v1/financial_records/",
            {
                "payment": str(self.payment.id),
                "amount": "75.00",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_other_user_cannot_create_financial_record(self):
        self._auth(self.other_token)
        response = self.api_client.post(
            "/api/v1/financial_records/",
            {
                "payment": str(self.payment.id),
                "amount": "75.00",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
