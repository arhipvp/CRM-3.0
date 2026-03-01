from datetime import timedelta
from decimal import Decimal

from apps.clients.models import Client
from apps.common.tests.auth_utils import AuthenticatedAPITestCase
from apps.deals.models import Deal, InsuranceCompany, InsuranceType
from apps.finances.models import FinancialRecord, Payment
from apps.policies.models import Policy
from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework import status


class PolicyComputedStatusAndNoteTests(AuthenticatedAPITestCase):
    def setUp(self):
        super().setUp()
        self.seller = User.objects.create_user(
            username="policy-status-seller", password="pass"
        )
        self.client = Client.objects.create(name="Client")
        self.deal = Deal.objects.create(
            title="Deal",
            client=self.client,
            seller=self.seller,
            status="open",
            stage_name="initial",
        )
        self.company = InsuranceCompany.objects.create(name="Company")
        self.insurance_type = InsuranceType.objects.create(name="Type")
        self.authenticate(self.seller)

    def _policy_payload(self, number: str, **overrides) -> dict:
        payload = {
            "number": number,
            "deal": str(self.deal.id),
            "insurance_company": str(self.company.id),
            "insurance_type": str(self.insurance_type.id),
        }
        payload.update(overrides)
        return payload

    def _create_policy(self, number: str, **overrides) -> Policy:
        return Policy.objects.create(
            number=number,
            deal=self.deal,
            insurance_company=self.company,
            insurance_type=self.insurance_type,
            **overrides,
        )

    def test_create_trims_note(self):
        response = self.api_client.post(
            "/api/v1/policies/",
            self._policy_payload("POL-NOTE-TRIM", note="  hello note  "),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["note"], "hello note")

    def test_create_rejects_too_long_note(self):
        response = self.api_client.post(
            "/api/v1/policies/",
            self._policy_payload("POL-NOTE-LONG", note="x" * 2001),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("note", response.data)

    def test_computed_status_priority_and_filter(self):
        today = timezone.localdate()
        problem_policy = self._create_policy("POL-PROBLEM", note="problem-case")
        due_policy = self._create_policy("POL-DUE", note="due-case")
        expired_policy = self._create_policy(
            "POL-EXPIRED", end_date=today - timedelta(days=1), note="expired-case"
        )
        active_policy = self._create_policy(
            "POL-ACTIVE", end_date=today + timedelta(days=10), note="active-case"
        )

        problem_payment = Payment.objects.create(
            policy=problem_policy,
            deal=self.deal,
            amount="100.00",
            actual_date=today,
        )
        FinancialRecord.objects.create(
            payment=problem_payment,
            amount=Decimal("100.00"),
            date=None,
        )
        Payment.objects.create(
            policy=due_policy,
            deal=self.deal,
            amount="100.00",
            actual_date=None,
        )

        list_response = self.api_client.get("/api/v1/policies/")
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        status_by_number = {
            item["number"]: item["computed_status"]
            for item in list_response.data.get("results", [])
        }
        self.assertEqual(status_by_number["POL-PROBLEM"], "problem")
        self.assertEqual(status_by_number["POL-DUE"], "due")
        self.assertEqual(status_by_number["POL-EXPIRED"], "expired")
        self.assertEqual(status_by_number["POL-ACTIVE"], "active")

        filtered = self.api_client.get("/api/v1/policies/?computed_status=due")
        self.assertEqual(filtered.status_code, status.HTTP_200_OK)
        numbers = {item["number"] for item in filtered.data.get("results", [])}
        self.assertEqual(numbers, {"POL-DUE"})

        note_filtered = self.api_client.get("/api/v1/policies/?note=expired-case")
        self.assertEqual(note_filtered.status_code, status.HTTP_200_OK)
        numbers = {item["number"] for item in note_filtered.data.get("results", [])}
        self.assertEqual(numbers, {"POL-EXPIRED"})

        date_filtered = self.api_client.get(
            f"/api/v1/policies/?end_date_from={today.isoformat()}"
        )
        self.assertEqual(date_filtered.status_code, status.HTTP_200_OK)
        numbers = {item["number"] for item in date_filtered.data.get("results", [])}
        self.assertIn(active_policy.number, numbers)
        self.assertNotIn(expired_policy.number, numbers)

        kpi_response = self.api_client.get("/api/v1/policies/kpi/")
        self.assertEqual(kpi_response.status_code, status.HTTP_200_OK)
        self.assertEqual(kpi_response.data["total"], 4)
        self.assertEqual(kpi_response.data["problem_count"], 1)
        self.assertEqual(kpi_response.data["due_count"], 1)

        kpi_filtered = self.api_client.get("/api/v1/policies/kpi/?search=active-case")
        self.assertEqual(kpi_filtered.status_code, status.HTTP_200_OK)
        self.assertEqual(kpi_filtered.data["total"], 1)
