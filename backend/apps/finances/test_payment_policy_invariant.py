from decimal import Decimal

from apps.clients.models import Client
from apps.common.tests.auth_utils import AuthenticatedAPITestCase
from apps.deals.models import Deal
from apps.finances.models import FinancialRecord, Payment
from apps.finances.permissions import get_deal_from_payment
from apps.policies.models import Policy
from django.contrib.auth.models import User
from rest_framework import status


class PaymentPolicyInvariantTests(AuthenticatedAPITestCase):
    def setUp(self):
        super().setUp()
        self.seller = User.objects.create_user(username="payment-policy-seller")
        self.client_obj = Client.objects.create(name="Payment Policy Client")
        self.deal = Deal.objects.create(
            title="Policy Deal",
            client=self.client_obj,
            seller=self.seller,
            status="open",
            stage_name="initial",
        )
        self.other_deal = Deal.objects.create(
            title="Other Deal",
            client=self.client_obj,
            seller=self.seller,
            status="open",
            stage_name="initial",
        )
        self.policy = Policy.objects.create(number="PAY-POLICY", deal=self.deal)
        self.authenticate(self.seller)

    def test_payment_api_requires_policy(self):
        response = self.api_client.post(
            "/api/v1/payments/",
            {
                "deal": str(self.deal.id),
                "amount": "1000.00",
                "description": "No policy payment",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("policy", response.data)

    def test_payment_api_derives_deal_from_policy(self):
        response = self.api_client.post(
            "/api/v1/payments/",
            {
                "policy": str(self.policy.id),
                "amount": "1000.00",
                "description": "Policy payment",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        payment = Payment.objects.get(pk=response.data["id"])
        self.assertEqual(payment.policy_id, self.policy.id)
        self.assertEqual(payment.deal_id, self.deal.id)

    def test_payment_api_rejects_deal_that_conflicts_with_policy(self):
        response = self.api_client.post(
            "/api/v1/payments/",
            {
                "policy": str(self.policy.id),
                "deal": str(self.other_deal.id),
                "amount": "1000.00",
                "description": "Mismatched payment",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("deal", response.data)

    def test_get_deal_from_payment_prefers_policy_deal(self):
        payment = Payment.objects.create(
            policy=self.policy,
            deal=self.deal,
            amount=Decimal("1000.00"),
        )
        Payment.objects.filter(pk=payment.pk).update(deal=self.other_deal)
        payment = Payment.objects.select_related("deal", "policy__deal").get(
            pk=payment.pk
        )

        self.assertEqual(get_deal_from_payment(payment), self.deal)

    def test_payment_api_representation_uses_policy_deal(self):
        payment = Payment.objects.create(
            policy=self.policy,
            deal=self.deal,
            amount=Decimal("1000.00"),
        )
        Payment.objects.filter(pk=payment.pk).update(deal=self.other_deal)

        response = self.api_client.get(f"/api/v1/payments/{payment.id}/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["deal"], str(self.deal.id))
        self.assertEqual(response.data["deal_title"], self.deal.title)

    def test_financial_record_api_representation_uses_policy_deal(self):
        payment = Payment.objects.create(
            policy=self.policy,
            deal=self.deal,
            amount=Decimal("1000.00"),
        )
        record = FinancialRecord.objects.create(
            payment=payment,
            amount=Decimal("100.00"),
        )
        Payment.objects.filter(pk=payment.pk).update(deal=self.other_deal)

        response = self.api_client.get(f"/api/v1/financial_records/{record.id}/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["deal_id"], str(self.deal.id))
        self.assertEqual(response.data["deal_title"], self.deal.title)
