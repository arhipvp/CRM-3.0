# -*- coding: cp866 -*-
from datetime import timedelta
from decimal import Decimal

from apps.clients.models import Client
from apps.common.tests.auth_utils import AuthenticatedAPITestCase
from apps.deals.models import Deal, InsuranceCompany, InsuranceType
from apps.finances.models import Payment
from apps.policies.models import Policy
from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework import status


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
        self.insurance_type = InsuranceType.objects.create(name="Type")
        self.authenticate(self.seller)

    def _create_policy(self, deal, number, start_date):
        return Policy.objects.create(
            number=number,
            deal=deal,
            insurance_company=self.company,
            insurance_type=self.insurance_type,
            start_date=start_date,
        )

    def test_dashboard_sums_paid_payments_for_current_month(self):
        today = timezone.localdate()
        month_start = today.replace(day=1)
        previous_month = month_start - timedelta(days=1)

        current_policy = self._create_policy(self.deal, "POLICY-1", today)
        previous_policy = self._create_policy(self.deal, "POLICY-OLD", previous_month)
        other_policy = self._create_policy(self.other_deal, "POLICY-OTHER", today)

        Payment.objects.create(
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
        Payment.objects.create(
            policy=previous_policy,
            deal=self.deal,
            amount=Decimal("200.00"),
            actual_date=today,
        )
        Payment.objects.create(
            policy=other_policy,
            deal=self.other_deal,
            amount=Decimal("300.00"),
            actual_date=today,
        )

        response = self.api_client.get("/api/v1/dashboard/seller/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        payload = response.json()
        self.assertEqual(payload.get("total_paid"), "100.00")
        policy_numbers = {item["number"] for item in payload.get("policies", [])}
        self.assertIn("POLICY-1", policy_numbers)
        self.assertNotIn("POLICY-OLD", policy_numbers)
        self.assertNotIn("POLICY-OTHER", policy_numbers)

    def test_dashboard_respects_custom_range(self):
        today = timezone.localdate()
        yesterday = today - timedelta(days=1)

        current_policy = self._create_policy(self.deal, "POLICY-TODAY", today)
        self._create_policy(self.deal, "POLICY-YESTERDAY", yesterday)

        Payment.objects.create(
            policy=current_policy,
            deal=self.deal,
            amount=Decimal("120.00"),
            actual_date=today,
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

    def test_dashboard_requires_both_dates(self):
        today = timezone.localdate()
        response = self.api_client.get(
            "/api/v1/dashboard/seller/",
            {"start_date": today.isoformat()},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
