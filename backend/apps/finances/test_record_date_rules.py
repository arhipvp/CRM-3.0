from datetime import date
from decimal import Decimal

from apps.clients.models import Client
from apps.common.tests.auth_utils import AuthenticatedAPITestCase
from apps.deals.models import Deal, InsuranceCompany, InsuranceType
from apps.finances.models import FinancialRecord, Payment, Statement
from apps.finances.serializers import FinancialRecordSerializer
from apps.policies.models import Policy
from django.contrib.auth.models import User
from rest_framework.exceptions import ValidationError


class RecordDateRulesTests(AuthenticatedAPITestCase):
    def setUp(self):
        super().setUp()
        self.seller = User.objects.create_user(username="date-rules-seller")
        client = Client.objects.create(name="Date rules client")
        self.deal = Deal.objects.create(
            title="Date rules deal", client=client, seller=self.seller
        )
        self.policy = Policy.objects.create(
            number="DATE-RULES",
            deal=self.deal,
            client=client,
            insurance_company=InsuranceCompany.objects.create(name="Date rules IC"),
            insurance_type=InsuranceType.objects.create(name="Date rules type"),
        )
        self.payment = Payment.objects.create(
            policy=self.policy, deal=self.deal, amount=Decimal("1000")
        )
        self.record = FinancialRecord.objects.create(
            payment=self.payment, amount=Decimal("100"), date=date(2026, 1, 2)
        )
        self.authenticate(self.seller)

    def test_direct_create_only_accepts_omitted_or_null_date(self):
        for date_input in ({}, {"date": None}, {"date": "2026-01-03"}):
            with self.subTest(date_input=date_input):
                count = FinancialRecord.objects.count()
                response = self.api_client.post(
                    "/api/v1/financial_records/",
                    {"payment": str(self.payment.pk), "amount": "25", **date_input},
                    format="json",
                )
                if date_input.get("date"):
                    self.assertEqual(response.status_code, 400)
                    self.assertIn("date", response.data)
                    self.assertEqual(FinancialRecord.objects.count(), count)
                else:
                    self.assertEqual(response.status_code, 201)
                    self.assertIsNone(response.data["date"])

    def test_direct_update_preserves_legacy_date_and_rejects_changes(self):
        for date_input in (
            {},
            {"date": "2026-01-02"},
            {"date": None},
            {"date": "2026-01-03"},
        ):
            with self.subTest(date_input=date_input):
                response = self.api_client.patch(
                    f"/api/v1/financial_records/{self.record.pk}/",
                    {"note": "Updated note", **date_input},
                    format="json",
                )
                allowed = "date" not in date_input or date_input["date"] == "2026-01-02"
                self.assertEqual(response.status_code, 200 if allowed else 400)
                self.record.refresh_from_db()
                self.assertEqual(self.record.date, date(2026, 1, 2))

    def test_payment_nested_dates_reject_entire_creation(self):
        for field in ("initial_record", "incomes", "expenses"):
            with self.subTest(field=field):
                draft = {"amount": "10", "date": "2026-01-03"}
                count = Payment.objects.count()
                response = self.api_client.post(
                    "/api/v1/payments/",
                    {
                        "policy": str(self.policy.pk),
                        "amount": "500",
                        field: draft if field == "initial_record" else [draft],
                    },
                    format="json",
                )
                self.assertEqual(response.status_code, 400)
                self.assertEqual(Payment.objects.count(), count)

    def test_update_revalidates_date_after_row_reload(self):
        serializer = FinancialRecordSerializer(
            self.record, data={"date": "2026-01-02", "note": "Stale"}, partial=True
        )
        serializer.is_valid(raise_exception=True)
        FinancialRecord.objects.filter(pk=self.record.pk).update(date=date(2026, 1, 4))
        with self.assertRaises(ValidationError):
            serializer.save()
        self.record.refresh_from_db()
        self.assertEqual(self.record.date, date(2026, 1, 4))
        self.assertNotEqual(self.record.note, "Stale")

    def test_omitted_date_does_not_overwrite_date_set_after_validation(self):
        serializer = FinancialRecordSerializer(
            self.record, data={"note": "Fresh note"}, partial=True
        )
        serializer.is_valid(raise_exception=True)
        FinancialRecord.objects.filter(pk=self.record.pk).update(date=date(2026, 1, 4))
        serializer.save()
        self.record.refresh_from_db()
        self.assertEqual(self.record.date, date(2026, 1, 4))
        self.assertEqual(self.record.note, "Fresh note")

    def test_update_rechecks_statement_paid_after_validation(self):
        serializer = FinancialRecordSerializer(
            self.record, data={"note": "Stale"}, partial=True
        )
        serializer.is_valid(raise_exception=True)
        statement = Statement.objects.create(
            name="Recently paid", statement_type="income", paid_at=date(2026, 1, 4)
        )
        FinancialRecord.objects.filter(pk=self.record.pk).update(statement=statement)
        with self.assertRaises(ValidationError):
            serializer.save()
