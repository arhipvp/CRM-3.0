from decimal import Decimal

from apps.clients.models import Client
from apps.common.tests.auth_utils import AuthenticatedAPITestCase
from apps.deals.models import Deal
from apps.finances.models import FinancialRecord, Payment, Statement
from apps.users.models import Role, UserRole
from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework import status


class FinanceAccessTests(AuthenticatedAPITestCase):
    """Проверяем доступ покупателей к платежам и финансовым записям сделок."""

    def setUp(self):
        super().setUp()
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


class FinanceStatementTests(AuthenticatedAPITestCase):
    def setUp(self):
        super().setUp()
        self.seller = User.objects.create_user(username="seller", password="pass")
        self.executor = User.objects.create_user(username="executor", password="pass")
        client = Client.objects.create(name="Client")
        self.deal = Deal.objects.create(
            title="Statement Deal",
            client=client,
            seller=self.seller,
            executor=self.executor,
            status="open",
            stage_name="initial",
        )
        self.payment = Payment.objects.create(
            deal=self.deal, amount=Decimal("1000.00"), description="Initial"
        )
        self.income_record = FinancialRecord.objects.create(
            payment=self.payment, amount=Decimal("150.00"), description="Income"
        )
        self.expense_record = FinancialRecord.objects.create(
            payment=self.payment, amount=Decimal("-75.00"), description="Expense"
        )

    def test_create_statement_with_income_records(self):
        self.authenticate(self.seller)
        response = self.api_client.post(
            "/api/v1/finance_statements/",
            {
                "name": "Income Sheet",
                "statement_type": "income",
                "record_ids": [str(self.income_record.id)],
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.income_record.refresh_from_db()
        self.assertIsNotNone(self.income_record.statement_id)

    def test_cannot_add_expense_to_income_statement(self):
        self.authenticate(self.seller)
        response = self.api_client.post(
            "/api/v1/finance_statements/",
            {
                "name": "Income Sheet",
                "statement_type": "income",
                "record_ids": [str(self.expense_record.id)],
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_record_cannot_be_used_in_multiple_statements(self):
        self.authenticate(self.seller)
        first = self.api_client.post(
            "/api/v1/finance_statements/",
            {
                "name": "Income Sheet",
                "statement_type": "income",
                "record_ids": [str(self.income_record.id)],
            },
            format="json",
        )
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        response = self.api_client.post(
            "/api/v1/finance_statements/",
            {
                "name": "Another Sheet",
                "statement_type": "income",
                "record_ids": [str(self.income_record.id)],
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cannot_edit_record_in_paid_statement(self):
        self.authenticate(self.seller)
        statement = Statement.objects.create(
            name="Paid Sheet",
            statement_type="income",
            status=Statement.STATUS_PAID,
            created_by=self.seller,
        )
        self.income_record.statement = statement
        self.income_record.save(update_fields=["statement"])
        response = self.api_client.patch(
            f"/api/v1/financial_records/{self.income_record.id}/",
            {"amount": "120.00"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cannot_delete_record_in_paid_statement(self):
        self.authenticate(self.seller)
        statement = Statement.objects.create(
            name="Paid Sheet",
            statement_type="income",
            status=Statement.STATUS_PAID,
            created_by=self.seller,
        )
        self.income_record.statement = statement
        self.income_record.save(update_fields=["statement"])
        response = self.api_client.delete(
            f"/api/v1/financial_records/{self.income_record.id}/"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_delete_statement_unlinks_records(self):
        self.authenticate(self.seller)
        statement = Statement.objects.create(
            name="Draft Sheet",
            statement_type="income",
            created_by=self.seller,
        )
        self.income_record.statement = statement
        self.income_record.save(update_fields=["statement"])
        response = self.api_client.delete(f"/api/v1/finance_statements/{statement.id}/")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.income_record.refresh_from_db()
        self.assertIsNone(self.income_record.statement_id)

    def test_cannot_delete_paid_statement(self):
        self.authenticate(self.seller)
        statement = Statement.objects.create(
            name="Paid Sheet",
            statement_type="income",
            status=Statement.STATUS_PAID,
            created_by=self.seller,
        )
        response = self.api_client.delete(f"/api/v1/finance_statements/{statement.id}/")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cannot_mark_paid_without_date(self):
        self.authenticate(self.seller)
        statement = Statement.objects.create(
            name="Draft Sheet",
            statement_type="income",
            created_by=self.seller,
        )
        response = self.api_client.post(
            f"/api/v1/finance_statements/{statement.id}/mark-paid/",
            {},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_mark_paid_updates_record_dates(self):
        self.authenticate(self.seller)
        statement = Statement.objects.create(
            name="To Pay",
            statement_type="income",
            status=Statement.STATUS_DRAFT,
            paid_at=timezone.now().date(),
            created_by=self.seller,
        )
        self.income_record.statement = statement
        self.income_record.save(update_fields=["statement"])
        response = self.api_client.post(
            f"/api/v1/finance_statements/{statement.id}/mark-paid/",
            {},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        statement.refresh_from_db()
        self.assertEqual(statement.status, Statement.STATUS_PAID)
        self.income_record.refresh_from_db()
        self.assertEqual(self.income_record.date, statement.paid_at)


class FinancialRecordFilterTests(AuthenticatedAPITestCase):
    def setUp(self):
        super().setUp()
        self.seller = User.objects.create_user(username="seller", password="pass")
        client = Client.objects.create(name="Search Client")
        self.deal = Deal.objects.create(
            title="Search Deal",
            client=client,
            seller=self.seller,
            status="open",
            stage_name="initial",
        )
        self.payment = Payment.objects.create(
            deal=self.deal, amount=Decimal("1000.00"), description="Payment seed"
        )
        self.income_record = FinancialRecord.objects.create(
            payment=self.payment, amount=Decimal("250.00"), note="AlphaNote"
        )
        self.expense_record = FinancialRecord.objects.create(
            payment=self.payment,
            amount=Decimal("-50.00"),
            description="Beta expense",
            date=timezone.now().date(),
        )

    def test_filter_unpaid_only(self):
        self.authenticate(self.seller)
        response = self.api_client.get("/api/v1/financial_records/?unpaid_only=true")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()
        results = payload.get("results", payload)
        record_ids = {str(item["id"]) for item in results}
        self.assertIn(str(self.income_record.id), record_ids)
        self.assertNotIn(str(self.expense_record.id), record_ids)

    def test_filter_record_type_income(self):
        self.authenticate(self.seller)
        response = self.api_client.get("/api/v1/financial_records/?record_type=income")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()
        results = payload.get("results", payload)
        record_ids = {str(item["id"]) for item in results}
        self.assertIn(str(self.income_record.id), record_ids)
        self.assertNotIn(str(self.expense_record.id), record_ids)

    def test_search_applies_only_after_five_chars(self):
        self.authenticate(self.seller)
        response_short = self.api_client.get("/api/v1/financial_records/?search=Alph")
        self.assertEqual(response_short.status_code, status.HTTP_200_OK)
        payload_short = response_short.json()
        results_short = payload_short.get("results", payload_short)
        record_ids_short = {str(item["id"]) for item in results_short}
        self.assertIn(str(self.income_record.id), record_ids_short)
        self.assertIn(str(self.expense_record.id), record_ids_short)

        response = self.api_client.get("/api/v1/financial_records/?search=AlphaNote")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()
        results = payload.get("results", payload)
        record_ids = {str(item["id"]) for item in results}
        self.assertIn(str(self.income_record.id), record_ids)
        self.assertNotIn(str(self.expense_record.id), record_ids)

    def test_filter_paid_balance_not_zero(self):
        self.authenticate(self.seller)
        paid_income = FinancialRecord.objects.create(
            payment=self.payment, amount=Decimal("60.00"), date=timezone.now().date()
        )
        response = self.api_client.get(
            "/api/v1/financial_records/?paid_balance_not_zero=true"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()
        results = payload.get("results", payload)
        record_ids = {str(item["id"]) for item in results}
        self.assertIn(str(paid_income.id), record_ids)


class FinanceStatementRemoveRecordsTests(AuthenticatedAPITestCase):
    def setUp(self):
        super().setUp()
        self.seller = User.objects.create_user(username="seller", password="pass")
        client = Client.objects.create(name="Remove Client")
        self.deal = Deal.objects.create(
            title="Remove Deal",
            client=client,
            seller=self.seller,
            status="open",
            stage_name="initial",
        )
        self.payment = Payment.objects.create(
            deal=self.deal, amount=Decimal("1000.00"), description="Seed"
        )
        self.income_record = FinancialRecord.objects.create(
            payment=self.payment, amount=Decimal("120.00")
        )
        self.statement = Statement.objects.create(
            name="Remove Sheet",
            statement_type="income",
            created_by=self.seller,
        )
        self.income_record.statement = self.statement
        self.income_record.save(update_fields=["statement"])

    def test_can_remove_record_from_statement(self):
        self.authenticate(self.seller)
        response = self.api_client.post(
            f"/api/v1/finance_statements/{self.statement.id}/remove-records/",
            {"record_ids": [str(self.income_record.id)]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.income_record.refresh_from_db()
        self.assertIsNone(self.income_record.statement_id)
