from apps.clients.models import Client
from apps.deals.models import Bank, Deal, InsuranceCompany, InsuranceType
from apps.policies.ai_service import _normalize_policy_payload
from apps.policies.models import Policy
from apps.policies.serializers import PolicySerializer
from django.test import TestCase


class MortgagePolicySerializerTests(TestCase):
    def setUp(self):
        self.client = Client.objects.create(name="Ипотечный клиент")
        self.deal = Deal.objects.create(title="Ипотечная сделка", client=self.client)
        self.company = InsuranceCompany.objects.create(name="Страховщик")
        self.mortgage_type = InsuranceType.objects.create(
            name="Ипотечное страхование имущества"
        )
        self.regular_type = InsuranceType.objects.create(name="ОСАГО")
        self.bank, _ = Bank.objects.get_or_create(name="Сбер")

    def _payload(self, **overrides):
        payload = {
            "number": "MORTGAGE-001",
            "deal": self.deal.id,
            "client": self.client.id,
            "insurance_company": self.company.id,
            "insurance_type": self.mortgage_type.id,
        }
        payload.update(overrides)
        return payload

    def test_mortgage_policy_requires_bank_and_loan_agreement_number(self):
        serializer = PolicySerializer(data=self._payload())

        self.assertFalse(serializer.is_valid())
        self.assertIn("mortgage_bank", serializer.errors)
        self.assertIn("loan_agreement_number", serializer.errors)

    def test_mortgage_policy_serializes_bank_details(self):
        serializer = PolicySerializer(
            data=self._payload(
                mortgage_bank=self.bank.id, loan_agreement_number="КД-123/45"
            )
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        policy = serializer.save()
        data = PolicySerializer(policy).data
        self.assertEqual(data["mortgage_bank"], self.bank.id)
        self.assertEqual(data["mortgage_bank_name"], "Сбер")
        self.assertEqual(data["loan_agreement_number"], "КД-123/45")

    def test_switching_to_non_mortgage_type_clears_mortgage_fields(self):
        policy = Policy.objects.create(
            number="MORTGAGE-002",
            deal=self.deal,
            client=self.client,
            insurance_company=self.company,
            insurance_type=self.mortgage_type,
            mortgage_bank=self.bank,
            loan_agreement_number="КД-123/45",
        )
        serializer = PolicySerializer(
            policy, data={"insurance_type": self.regular_type.id}, partial=True
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()
        policy.refresh_from_db()
        self.assertIsNone(policy.mortgage_bank)
        self.assertEqual(policy.loan_agreement_number, "")

    def test_recognition_clears_mortgage_data_for_non_mortgage_type(self):
        data = _normalize_policy_payload(
            {
                "client_name": "",
                "policy": {
                    "insurance_type": "ОСАГО",
                    "mortgage_bank": "Сбер",
                    "loan_agreement_number": "КД-123/45",
                },
                "payments": [],
            }
        )

        self.assertEqual(data["policy"]["mortgage_bank"], "")
        self.assertEqual(data["policy"]["loan_agreement_number"], "")
