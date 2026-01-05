# -*- coding: cp866 -*-
from decimal import Decimal

from apps.clients.models import Client
from apps.common.tests.auth_utils import AuthenticatedAPITestCase
from apps.deals.models import Deal, InsuranceCompany, InsuranceType
from apps.finances.models import FinancialRecord, Payment
from apps.policies.models import Policy
from django.contrib.auth.models import User
from rest_framework import status


class PolicyFilterTests(AuthenticatedAPITestCase):
    def setUp(self):
        super().setUp()
        self.seller = User.objects.create_user(username="seller", password="pass")
        client = Client.objects.create(name="Client")
        self.deal = Deal.objects.create(
            title="Deal",
            client=client,
            seller=self.seller,
            status="open",
            stage_name="initial",
        )
        self.company = InsuranceCompany.objects.create(name="Company")
        self.insurance_type = InsuranceType.objects.create(name="Type")
        self.authenticate(self.seller)

    def _create_policy(self, number: str) -> Policy:
        return Policy.objects.create(
            number=number,
            deal=self.deal,
            insurance_company=self.company,
            insurance_type=self.insurance_type,
        )

    def test_unpaid_filter_returns_only_unpaid(self):
        unpaid_policy = self._create_policy("POLICY-UNPAID")
        paid_policy = self._create_policy("POLICY-PAID")
        record_unpaid_policy = self._create_policy("POLICY-RECORD-UNPAID")

        Payment.objects.create(
            policy=unpaid_policy,
            deal=self.deal,
            amount="100.00",
        )
        paid_payment = Payment.objects.create(
            policy=paid_policy,
            deal=self.deal,
            amount="100.00",
            actual_date="2024-01-05",
        )
        FinancialRecord.objects.create(
            payment=paid_payment,
            amount=Decimal("50.00"),
            date="2024-01-06",
        )

        record_payment = Payment.objects.create(
            policy=record_unpaid_policy,
            deal=self.deal,
            amount="200.00",
            actual_date="2024-02-01",
        )
        FinancialRecord.objects.create(
            payment=record_payment,
            amount=Decimal("200.00"),
            date=None,
        )

        response = self.api_client.get("/api/v1/policies/?unpaid=true")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.json().get("results", [])
        numbers = {item["number"] for item in results}
        self.assertIn("POLICY-UNPAID", numbers)
        self.assertIn("POLICY-RECORD-UNPAID", numbers)
        self.assertNotIn("POLICY-PAID", numbers)
