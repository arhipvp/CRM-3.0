from datetime import date, timedelta
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
            scheduled_date=today,
            actual_date=today,
        )
        Payment.objects.create(
            policy=current_policy,
            deal=self.deal,
            amount=Decimal("50.00"),
            scheduled_date=today,
            actual_date=None,
        )
        previous_payment = Payment.objects.create(
            policy=previous_policy,
            deal=self.deal,
            amount=Decimal("200.00"),
            scheduled_date=previous_month,
            actual_date=today,
        )
        other_payment = Payment.objects.create(
            policy=other_policy,
            deal=self.other_deal,
            amount=Decimal("300.00"),
            scheduled_date=today,
            actual_date=today,
        )
        unknown_payment = Payment.objects.create(
            policy=unknown_policy,
            deal=self.deal,
            amount=Decimal("10.00"),
            scheduled_date=today,
            actual_date=today,
        )
        payment_without_policy = Payment.objects.create(
            policy=None,
            deal=self.deal,
            amount=Decimal("20.00"),
            scheduled_date=today,
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
        self.assertEqual(
            payload.get("payments_by_day"),
            [{"date": today.isoformat(), "total": "110.00"}],
        )
        self.assertTrue(payload.get("tasks_completed_by_day"))
        self.assertTrue(payload.get("tasks_completed_by_executor"))
        policy_numbers = {item["number"] for item in payload.get("policies", [])}
        self.assertIn("POLICY-1", policy_numbers)
        self.assertNotIn("POLICY-OLD", policy_numbers)
        self.assertNotIn("POLICY-OTHER", policy_numbers)

        financial_totals = payload.get("financial_totals", {})
        self.assertEqual(financial_totals.get("income_total"), "160.00")
        self.assertEqual(financial_totals.get("expense_total"), "65.00")
        self.assertEqual(financial_totals.get("net_total"), "95.00")
        self.assertEqual(financial_totals.get("records_count"), 4)

        rows = payload.get("financial_by_company_type", [])
        by_key = {
            (row["insurance_company_name"], row["insurance_type_name"]): row
            for row in rows
        }
        self.assertIn(("Company", "Type"), by_key)
        self.assertIn(("Не указано", "Не указано"), by_key)

        company_row = by_key[("Company", "Type")]
        self.assertEqual(company_row["income_total"], "160.00")
        self.assertEqual(company_row["expense_total"], "40.00")
        self.assertEqual(company_row["net_total"], "120.00")
        self.assertEqual(company_row["records_count"], 3)

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
            scheduled_date=today,
            actual_date=today,
        )
        yesterday_payment = Payment.objects.create(
            policy=yesterday_policy,
            deal=self.deal,
            amount=Decimal("80.00"),
            scheduled_date=yesterday,
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
        self.assertEqual(
            payload.get("payments_by_day"),
            [{"date": today.isoformat(), "total": "120.00"}],
        )

    def test_dashboard_excludes_renewed_policy_expirations(self):
        today = timezone.localdate()
        expiring_policy = Policy.objects.create(
            number="POLICY-EXPIRING",
            deal=self.deal,
            insurance_company=self.company,
            insurance_type=self.insurance_type,
            start_date=today - timedelta(days=30),
            end_date=today + timedelta(days=4),
        )
        successor_policy = Policy.objects.create(
            number="POLICY-SUCCESSOR",
            deal=self.deal,
            insurance_company=self.company,
            insurance_type=self.insurance_type,
            start_date=today + timedelta(days=5),
            end_date=today + timedelta(days=370),
        )
        expiring_policy.renewed_by = successor_policy
        expiring_policy.save(update_fields=["renewed_by", "updated_at"])

        response = self.api_client.get(
            "/api/v1/dashboard/seller/",
            {
                "start_date": today.isoformat(),
                "end_date": (today + timedelta(days=10)).isoformat(),
            },
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        payload = response.json()
        self.assertEqual(payload.get("policy_expirations_by_day"), [])

    def test_dashboard_requires_both_dates(self):
        today = timezone.localdate()
        response = self.api_client.get(
            "/api/v1/dashboard/seller/",
            {"start_date": today.isoformat()},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_dashboard_uses_payment_scheduled_date_for_paid_and_financial_totals(self):
        january_day = date(2026, 1, 15)
        january_end = date(2026, 1, 31)
        march_day = date(2026, 3, 10)
        june_day = date(2026, 6, 1)

        january_policy = self._create_policy(
            self.deal,
            "POLICY-JAN",
            january_day,
            company=self.company,
            insurance_type=self.insurance_type,
        )

        january_payment = Payment.objects.create(
            policy=january_policy,
            deal=self.deal,
            amount=Decimal("120.00"),
            scheduled_date=january_day,
            actual_date=march_day,
        )

        FinancialRecord.objects.create(
            payment=january_payment,
            amount=Decimal("80.00"),
            date=march_day,
        )
        FinancialRecord.objects.create(
            payment=january_payment,
            amount=Decimal("-30.00"),
            date=june_day,
        )

        january_response = self.api_client.get(
            "/api/v1/dashboard/seller/",
            {
                "start_date": date(2026, 1, 1).isoformat(),
                "end_date": january_end.isoformat(),
            },
        )
        self.assertEqual(january_response.status_code, status.HTTP_200_OK)
        january_payload = january_response.json()
        self.assertEqual(january_payload.get("total_paid"), "120.00")
        self.assertEqual(
            january_payload.get("payments_by_day"),
            [{"date": january_day.isoformat(), "total": "120.00"}],
        )
        january_financial_totals = january_payload.get("financial_totals", {})
        self.assertEqual(january_financial_totals.get("income_total"), "80.00")
        self.assertEqual(january_financial_totals.get("expense_total"), "30.00")
        self.assertEqual(january_financial_totals.get("net_total"), "50.00")
        self.assertEqual(january_financial_totals.get("records_count"), 2)

        january_rows = january_payload.get("financial_by_company_type", [])
        self.assertEqual(len(january_rows), 1)
        self.assertEqual(january_rows[0]["insurance_company_name"], "Company")
        self.assertEqual(january_rows[0]["insurance_type_name"], "Type")
        self.assertEqual(january_rows[0]["income_total"], "80.00")
        self.assertEqual(january_rows[0]["expense_total"], "30.00")
        self.assertEqual(january_rows[0]["net_total"], "50.00")
        self.assertEqual(january_rows[0]["records_count"], 2)

        march_response = self.api_client.get(
            "/api/v1/dashboard/seller/",
            {
                "start_date": date(2026, 3, 1).isoformat(),
                "end_date": date(2026, 3, 31).isoformat(),
            },
        )
        self.assertEqual(march_response.status_code, status.HTTP_200_OK)
        march_payload = march_response.json()
        self.assertEqual(march_payload.get("total_paid"), "0.00")
        self.assertEqual(march_payload.get("payments_by_day"), [])
        march_financial_totals = march_payload.get("financial_totals", {})
        self.assertEqual(march_financial_totals.get("income_total"), "0.00")
        self.assertEqual(march_financial_totals.get("expense_total"), "0.00")
        self.assertEqual(march_financial_totals.get("net_total"), "0.00")
        self.assertEqual(march_financial_totals.get("records_count"), 0)

        june_response = self.api_client.get(
            "/api/v1/dashboard/seller/",
            {
                "start_date": date(2026, 6, 1).isoformat(),
                "end_date": date(2026, 6, 30).isoformat(),
            },
        )
        self.assertEqual(june_response.status_code, status.HTTP_200_OK)
        june_payload = june_response.json()
        self.assertEqual(june_payload.get("total_paid"), "0.00")
        self.assertEqual(june_payload.get("payments_by_day"), [])
        june_financial_totals = june_payload.get("financial_totals", {})
        self.assertEqual(june_financial_totals.get("income_total"), "0.00")
        self.assertEqual(june_financial_totals.get("expense_total"), "0.00")
        self.assertEqual(june_financial_totals.get("net_total"), "0.00")
        self.assertEqual(june_financial_totals.get("records_count"), 0)

    def test_dashboard_excludes_payments_without_scheduled_date(self):
        january_day = date(2026, 1, 20)
        policy = self._create_policy(self.deal, "POLICY-NO-SCHEDULE", january_day)
        payment = Payment.objects.create(
            policy=policy,
            deal=self.deal,
            amount=Decimal("150.00"),
            scheduled_date=None,
            actual_date=january_day,
        )
        FinancialRecord.objects.create(
            payment=payment,
            amount=Decimal("90.00"),
            date=january_day,
        )
        FinancialRecord.objects.create(
            payment=payment,
            amount=Decimal("-20.00"),
            date=january_day,
        )

        response = self.api_client.get(
            "/api/v1/dashboard/seller/",
            {
                "start_date": date(2026, 1, 1).isoformat(),
                "end_date": date(2026, 1, 31).isoformat(),
            },
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()
        self.assertEqual(payload.get("total_paid"), "0.00")
        self.assertEqual(payload.get("payments_by_day"), [])
        financial_totals = payload.get("financial_totals", {})
        self.assertEqual(financial_totals.get("income_total"), "0.00")
        self.assertEqual(financial_totals.get("expense_total"), "0.00")
        self.assertEqual(financial_totals.get("net_total"), "0.00")
        self.assertEqual(financial_totals.get("records_count"), 0)
