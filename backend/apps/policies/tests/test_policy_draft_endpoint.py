from datetime import date
from decimal import Decimal
from uuid import uuid4

from apps.clients.models import Client
from apps.common.tests.auth_utils import AuthenticatedAPITestCase
from apps.deals.models import Deal, InsuranceCompany, InsuranceType
from apps.finances.models import FinancialRecord, Payment, Statement
from apps.policies.models import Policy
from django.contrib.auth.models import User
from rest_framework import status


class PolicyDraftEndpointTests(AuthenticatedAPITestCase):
    def setUp(self):
        super().setUp()
        self.seller = User.objects.create_user(username="policy-draft-seller")
        self.client_obj = Client.objects.create(name="Draft Client")
        self.deal = Deal.objects.create(
            title="Draft Deal",
            client=self.client_obj,
            seller=self.seller,
            status="open",
            stage_name="initial",
        )
        self.company = InsuranceCompany.objects.create(name="Draft Company")
        self.insurance_type = InsuranceType.objects.create(name="Draft Type")

    def _draft_payload(self, **overrides):
        payload = {
            "deal": str(self.deal.id),
            "number": "DRAFT-001",
            "insurance_company": str(self.company.id),
            "insurance_type": str(self.insurance_type.id),
            "client": str(self.client_obj.id),
            "is_vehicle": True,
            "brand": "Toyota",
            "model": "Camry",
            "vin": "JTMZZZ12345678901",
            "deductible": "0.00",
            "official_dealer": False,
            "gap": False,
            "counterparty": "Draft Counterparty",
            "note": "Draft note",
            "start_date": "2026-01-01",
            "end_date": "2026-12-31",
            "payments": [
                {
                    "amount": "1000.00",
                    "description": "Первый платёж",
                    "scheduled_date": "2026-01-10",
                    "actual_date": "2026-01-11",
                    "incomes": [
                        {
                            "amount": "120.00",
                            "date": "2026-01-11",
                            "description": "Комиссия",
                            "source": "Агент",
                            "note": "income note",
                        }
                    ],
                    "expenses": [
                        {
                            "amount": "30.00",
                            "date": "2026-01-12",
                            "description": "Расход",
                        }
                    ],
                }
            ],
        }
        payload.update(overrides)
        return payload

    def test_draft_create_creates_policy_payments_and_records_atomically(self):
        self.authenticate(self.seller)

        response = self.api_client.post(
            "/api/v1/policies/draft/",
            self._draft_payload(),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        policy = Policy.objects.get(number="DRAFT-001")
        payment = Payment.objects.get(policy=policy)
        records = list(payment.financial_records.order_by("record_type", "amount"))

        self.assertEqual(policy.deal_id, self.deal.id)
        self.assertEqual(payment.deal_id, self.deal.id)
        self.assertEqual(payment.amount, Decimal("1000.00"))
        self.assertEqual(len(records), 2)
        self.assertEqual(
            FinancialRecord.objects.get(
                record_type=FinancialRecord.RecordType.EXPENSE
            ).amount,
            Decimal("-30.00"),
        )
        self.assertIn("policy", response.json())
        self.assertEqual(len(response.json()["payments"]), 1)

    def test_draft_create_recalculates_deal_deadline(self):
        self.authenticate(self.seller)

        response = self.api_client.post(
            "/api/v1/policies/draft/",
            self._draft_payload(
                end_date="2026-12-31",
                payments=[
                    {
                        "amount": "1000.00",
                        "description": "Неоплаченная рассрочка",
                        "scheduled_date": "2026-03-10",
                        "actual_date": None,
                        "incomes": [],
                        "expenses": [],
                    }
                ],
            ),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.deal.refresh_from_db()
        self.assertEqual(self.deal.expected_close, date(2026, 3, 10))

    def test_draft_update_updates_and_removes_missing_draft_entities(self):
        self.authenticate(self.seller)
        policy = Policy.objects.create(
            number="OLD-DRAFT",
            deal=self.deal,
            insurance_company=self.company,
            insurance_type=self.insurance_type,
            client=self.client_obj,
        )
        keep_payment = Payment.objects.create(
            policy=policy,
            deal=self.deal,
            amount=Decimal("500.00"),
            description="old",
        )
        remove_payment = Payment.objects.create(
            policy=policy,
            deal=self.deal,
            amount=Decimal("300.00"),
        )
        keep_record = FinancialRecord.objects.create(
            payment=keep_payment,
            amount=Decimal("50.00"),
            record_type=FinancialRecord.RecordType.INCOME,
            description="old income",
        )
        remove_record = FinancialRecord.objects.create(
            payment=keep_payment,
            amount=Decimal("-20.00"),
            record_type=FinancialRecord.RecordType.EXPENSE,
        )

        payload = self._draft_payload(
            number="NEW-DRAFT",
            payments=[
                {
                    "id": str(keep_payment.id),
                    "amount": "700.00",
                    "description": "updated",
                    "incomes": [
                        {
                            "id": str(keep_record.id),
                            "amount": "70.00",
                            "description": "updated income",
                        }
                    ],
                    "expenses": [],
                }
            ],
        )
        response = self.api_client.patch(
            f"/api/v1/policies/{policy.id}/draft/",
            payload,
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        policy.refresh_from_db()
        keep_payment.refresh_from_db()
        keep_record.refresh_from_db()
        remove_payment.refresh_from_db()
        remove_record.refresh_from_db()

        self.assertEqual(policy.number, "NEW-DRAFT")
        self.assertEqual(keep_payment.amount, Decimal("700.00"))
        self.assertEqual(keep_record.amount, Decimal("70.00"))
        self.assertIsNotNone(remove_payment.deleted_at)
        self.assertIsNotNone(remove_record.deleted_at)

    def test_draft_rolls_back_policy_when_nested_record_is_invalid(self):
        self.authenticate(self.seller)
        payload = self._draft_payload(
            number="ROLLBACK-DRAFT",
            payments=[
                {
                    "amount": "1000.00",
                    "incomes": [{"id": str(uuid4()), "amount": "100.00"}],
                    "expenses": [],
                }
            ],
        )

        response = self.api_client.post(
            "/api/v1/policies/draft/",
            payload,
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Policy.objects.filter(number="ROLLBACK-DRAFT").exists())
        self.assertEqual(Payment.objects.count(), 0)

    def test_draft_update_blocks_paid_statement_record_change(self):
        self.authenticate(self.seller)
        policy = Policy.objects.create(
            number="PAID-STMT",
            deal=self.deal,
            insurance_company=self.company,
            insurance_type=self.insurance_type,
            client=self.client_obj,
        )
        payment = Payment.objects.create(
            policy=policy,
            deal=self.deal,
            amount=Decimal("500.00"),
        )
        statement = Statement.objects.create(
            name="Paid Statement",
            statement_type=Statement.TYPE_INCOME,
            paid_at=date(2026, 1, 31),
        )
        record = FinancialRecord.objects.create(
            payment=payment,
            statement=statement,
            amount=Decimal("50.00"),
            record_type=FinancialRecord.RecordType.INCOME,
        )

        payload = self._draft_payload(
            number=policy.number,
            payments=[
                {
                    "id": str(payment.id),
                    "amount": "500.00",
                    "incomes": [{"id": str(record.id), "amount": "60.00"}],
                    "expenses": [],
                }
            ],
        )
        response = self.api_client.patch(
            f"/api/v1/policies/{policy.id}/draft/",
            payload,
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            response.json()["detail"],
            "Нельзя изменять записи в выплаченной ведомости.",
        )
        record.refresh_from_db()
        self.assertEqual(record.amount, Decimal("50.00"))

    def test_draft_update_blocks_draft_statement_record_delete(self):
        self.authenticate(self.seller)
        policy = Policy.objects.create(
            number="DRAFT-STMT",
            deal=self.deal,
            insurance_company=self.company,
            insurance_type=self.insurance_type,
            client=self.client_obj,
        )
        payment = Payment.objects.create(
            policy=policy,
            deal=self.deal,
            amount=Decimal("500.00"),
        )
        statement = Statement.objects.create(
            name="Draft Statement",
            statement_type=Statement.TYPE_INCOME,
        )
        FinancialRecord.objects.create(
            payment=payment,
            statement=statement,
            amount=Decimal("50.00"),
            record_type=FinancialRecord.RecordType.INCOME,
        )

        response = self.api_client.patch(
            f"/api/v1/policies/{policy.id}/draft/",
            self._draft_payload(
                number=policy.number,
                payments=[
                    {
                        "id": str(payment.id),
                        "amount": "500.00",
                        "incomes": [],
                        "expenses": [],
                    }
                ],
            ),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            response.json()["detail"], "Сначала уберите запись из ведомости"
        )
