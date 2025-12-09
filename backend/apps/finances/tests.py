from decimal import Decimal

from apps.clients.models import Client
from apps.common.tests.auth_utils import AuthenticatedAPITestCase
from apps.deals.models import Deal
from apps.finances.models import FinancialRecord, Payment
from apps.users.models import Role, UserRole
from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework import status


class FinanceAccessTests(AuthenticatedAPITestCase):
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

    def test_seller_can_create_payment(self):
        self.authenticate(self.seller)
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
        self.authenticate(self.executor)
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
        self.authenticate(self.other_user)
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
        self.authenticate(self.seller)
        response = self.api_client.post(
            "/api/v1/financial_records/",
            {
                "payment": str(self.payment.id),
                "amount": "50.00",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_executor_cannot_create_financial_record(self):
        self.authenticate(self.executor)
        response = self.api_client.post(
            "/api/v1/financial_records/",
            {
                "payment": str(self.payment.id),
                "amount": "75.00",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_other_user_cannot_create_financial_record(self):
        self.authenticate(self.other_user)
        response = self.api_client.post(
            "/api/v1/financial_records/",
            {
                "payment": str(self.payment.id),
                "amount": "75.00",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_seller_can_update_financial_record(self):
        self.authenticate(self.seller)
        response = self.api_client.patch(
            f"/api/v1/financial_records/{self.fin_record.id}/",
            {"amount": "-50.00"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_executor_cannot_update_financial_record(self):
        self.authenticate(self.executor)
        response = self.api_client.patch(
            f"/api/v1/financial_records/{self.fin_record.id}/",
            {"amount": "-25.00"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_other_user_cannot_update_financial_record(self):
        self.authenticate(self.other_user)
        response = self.api_client.patch(
            f"/api/v1/financial_records/{self.fin_record.id}/",
            {"amount": "25.00"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_executor_cannot_delete_financial_record(self):
        self.authenticate(self.executor)
        response = self.api_client.delete(
            f"/api/v1/financial_records/{self.fin_record.id}/"
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_other_user_cannot_delete_financial_record(self):
        self.authenticate(self.other_user)
        response = self.api_client.delete(
            f"/api/v1/financial_records/{self.fin_record.id}/"
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_seller_can_delete_unpaid_payment(self):
        self.authenticate(self.seller)
        response = self.api_client.delete(f"/api/v1/payments/{self.payment.id}/")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_cannot_delete_paid_payment(self):
        paid_payment = Payment.objects.create(
            deal=self.deal,
            amount=Decimal("500.00"),
            description="Paid",
            actual_date=timezone.now(),
        )
        self.authenticate(self.seller)
        response = self.api_client.delete(f"/api/v1/payments/{paid_payment.id}/")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
