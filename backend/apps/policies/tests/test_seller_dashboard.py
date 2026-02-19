from datetime import timedelta
from decimal import Decimal

from apps.clients.models import Client
from apps.common.tests.auth_utils import AuthenticatedAPITestCase
from apps.deals.models import Deal, InsuranceCompany, InsuranceType
from apps.finances.models import FinancialRecord, Payment
from apps.policies.models import Policy
from apps.tasks.models import Task
from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework import status

_UNSET = object()


class SellerDashboardTests(AuthenticatedAPITestCase):
    def setUp(self):
        super().setUp()
        self.seller = User.objects.create_user(username="seller", password="pass")
        self.other_user = User.objects.create_user(username="other", password="pass")
        self.client_obj = Client.objects.create(name="Client")
        self.deal = Deal.objects.create(
            title="Deal",
            client=self.client_obj,
            seller=self.seller,
            status="open",
            stage_name="initial",
        )
        self.other_deal = Deal.objects.create(
            title="Other Deal",
            client=self.client_obj,
            seller=self.other_user,
            status="open",
            stage_name="initial",
        )
        self.company = InsuranceCompany.objects.create(name="Company")
        self.company_b = InsuranceCompany.objects.create(name="Company B")
        self.insurance_type = InsuranceType.objects.create(name="Type")
        self.insurance_type_b = InsuranceType.objects.create(name="Type B")
        self.authenticate(self.seller)

    def _create_policy(
        self,
        deal,
        number,
        start_date,
        company=_UNSET,
        insurance_type=_UNSET,
    ):
        return Policy.objects.create(
            number=number,
            deal=deal,
            insurance_company=self.company if company is _UNSET else company,
            insurance_type=(
                self.insurance_type if insurance_type is _UNSET else insurance_type
            ),
            start_date=start_date,
        )

    def test_dashboard_sums_paid_payments_for_current_month(self):
        today = timezone.localdate()
        month_start = today.replace(day=1)
        previous_month = month_start - timedelta(days=1)

        current_policy = self._create_policy(
            self.deal,
            "POLICY-1",
            today,
            company=self.company,
            insurance_type=self.insurance_type,
        )
        unknown_policy = self._create_policy(
            self.deal,
            "POLICY-NULL",
            today,
            company=None,
            insurance_type=None,
        )
        previous_policy = self._create_policy(self.deal, "POLICY-OLD", previous_month)
        other_policy = self._create_policy(
            self.other_deal,
            "POLICY-OTHER",
            today,
            company=self.company_b,
            insurance_type=self.insurance_type_b,
        )

        current_payment = Payment.objects.create(
            policy=current_policy,
            deal=self.deal,
            amount=Decimal("100.00"),
            actual_date=today,
        )
        Payment.objects.create(
            policy=current_policy,
            deal=self.deal,
            amount=Decimal("50.00"),
            actual_date=None,
        )
        previous_payment = Payment.objects.create(
            policy=previous_policy,
            deal=self.deal,
            amount=Decimal("200.00"),
            actual_date=today,
        )
        other_payment = Payment.objects.create(
            policy=other_policy,
            deal=self.other_deal,
            amount=Decimal("300.00"),
            actual_date=today,
        )
        unknown_payment = Payment.objects.create(
            policy=unknown_policy,
            deal=self.deal,
            amount=Decimal("10.00"),
            actual_date=today,
        )
        payment_without_policy = Payment.objects.create(
            policy=None,
            deal=self.deal,
            amount=Decimal("20.00"),
            actual_date=today,
        )

        FinancialRecord.objects.create(
            payment=current_payment,
            amount=Decimal("150.00"),
            date=today,
        )
        FinancialRecord.objects.create(
            payment=current_payment,
            amount=Decimal("-40.00"),
            date=today,
        )
        FinancialRecord.objects.create(
            payment=current_payment,
            amount=Decimal("10.00"),
            date=None,
        )
        FinancialRecord.objects.create(
            payment=unknown_payment,
            amount=Decimal("-25.00"),
            date=today,
        )
        FinancialRecord.objects.create(
            payment=previous_payment,
            amount=Decimal("70.00"),
            date=today,
        )
        FinancialRecord.objects.create(
            payment=other_payment,
            amount=Decimal("90.00"),
            date=today,
        )
        FinancialRecord.objects.create(
            payment=payment_without_policy,
            amount=Decimal("33.00"),
            date=today,
        )

        Task.objects.create(
            title="Active task",
            deal=self.deal,
            assignee=self.other_user,
            status=Task.TaskStatus.IN_PROGRESS,
        )
        Task.objects.create(
            title="Done task",
            deal=self.deal,
            assignee=self.seller,
            status=Task.TaskStatus.DONE,
            completed_at=timezone.now(),
        )
        Task.objects.create(
            title="Other user's task",
            deal=self.other_deal,
            assignee=self.other_user,
            status=Task.TaskStatus.IN_PROGRESS,
        )

        response = self.api_client.get("/api/v1/dashboard/seller/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        payload = response.json()
        self.assertEqual(payload.get("total_paid"), "110.00")
        self.assertEqual(payload.get("tasks_current"), 1)
        self.assertEqual(payload.get("tasks_completed"), 1)
        self.assertTrue(payload.get("payments_by_day"))
        self.assertTrue(payload.get("tasks_completed_by_day"))
        self.assertTrue(payload.get("tasks_completed_by_executor"))
        policy_numbers = {item["number"] for item in payload.get("policies", [])}
        self.assertIn("POLICY-1", policy_numbers)
        self.assertNotIn("POLICY-OLD", policy_numbers)
        self.assertNotIn("POLICY-OTHER", policy_numbers)

        financial_totals = payload.get("financial_totals", {})
        self.assertEqual(financial_totals.get("income_total"), "150.00")
        self.assertEqual(financial_totals.get("expense_total"), "65.00")
        self.assertEqual(financial_totals.get("net_total"), "85.00")
        self.assertEqual(financial_totals.get("records_count"), 3)

        rows = payload.get("financial_by_company_type", [])
        by_key = {
            (row["insurance_company_name"], row["insurance_type_name"]): row
            for row in rows
        }
        self.assertIn(("Company", "Type"), by_key)
        self.assertIn(("Не указано", "Не указано"), by_key)

        company_row = by_key[("Company", "Type")]
        self.assertEqual(company_row["income_total"], "150.00")
        self.assertEqual(company_row["expense_total"], "40.00")
        self.assertEqual(company_row["net_total"], "110.00")
        self.assertEqual(company_row["records_count"], 2)

        unknown_row = by_key[("Не указано", "Не указано")]
        self.assertEqual(unknown_row["income_total"], "0.00")
        self.assertEqual(unknown_row["expense_total"], "25.00")
        self.assertEqual(unknown_row["net_total"], "-25.00")
        self.assertEqual(unknown_row["records_count"], 1)

    def test_dashboard_respects_custom_range(self):
        today = timezone.localdate()
        yesterday = today - timedelta(days=1)

        current_policy = self._create_policy(self.deal, "POLICY-TODAY", today)
        yesterday_policy = self._create_policy(self.deal, "POLICY-YESTERDAY", yesterday)

        current_payment = Payment.objects.create(
            policy=current_policy,
            deal=self.deal,
            amount=Decimal("120.00"),
            actual_date=today,
        )
        yesterday_payment = Payment.objects.create(
            policy=yesterday_policy,
            deal=self.deal,
            amount=Decimal("80.00"),
            actual_date=today,
        )
        FinancialRecord.objects.create(
            payment=current_payment,
            amount=Decimal("120.00"),
            date=today,
        )
        FinancialRecord.objects.create(
            payment=yesterday_payment,
            amount=Decimal("-50.00"),
            date=today,
        )

        response = self.api_client.get(
            "/api/v1/dashboard/seller/",
            {"start_date": today.isoformat(), "end_date": today.isoformat()},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        payload = response.json()
        policy_numbers = {item["number"] for item in payload.get("policies", [])}
        self.assertIn("POLICY-TODAY", policy_numbers)
        self.assertNotIn("POLICY-YESTERDAY", policy_numbers)
        financial_totals = payload.get("financial_totals", {})
        self.assertEqual(financial_totals.get("income_total"), "120.00")
        self.assertEqual(financial_totals.get("expense_total"), "0.00")
        self.assertEqual(financial_totals.get("net_total"), "120.00")
        self.assertEqual(financial_totals.get("records_count"), 1)

    def test_dashboard_requires_both_dates(self):
        today = timezone.localdate()
        response = self.api_client.get(
            "/api/v1/dashboard/seller/",
            {"start_date": today.isoformat()},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
