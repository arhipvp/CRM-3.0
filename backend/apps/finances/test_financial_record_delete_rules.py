from datetime import date

from apps.clients.models import Client
from apps.common.tests.auth_utils import AuthenticatedAPITestCase
from apps.deals.models import Deal, InsuranceCompany, InsuranceType
from apps.finances.models import FinancialRecord, Payment, Statement
from apps.policies.models import Policy
from django.contrib.auth.models import User
from rest_framework import status


class FinancialRecordDeleteRulesTests(AuthenticatedAPITestCase):
    def setUp(self):
        super().setUp()
        self.seller = User.objects.create_user(username="seller_fin_record_delete")
        self.client_entity = Client.objects.create(
            name="Financial Record Delete Client"
        )
        self.deal = Deal.objects.create(
            title="Financial Record Delete Deal",
            client=self.client_entity,
            seller=self.seller,
            status="open",
            stage_name="initial",
        )
        self.insurance_company = InsuranceCompany.objects.create(
            name="Financial Record Delete Company",
            description="Company for financial record delete tests",
        )
        self.insurance_type = InsuranceType.objects.create(
            name="Financial Record Delete Type",
            description="Type for financial record delete tests",
        )
        self.policy = Policy.objects.create(
            number="FIN-REC-DELETE-001",
            deal=self.deal,
            insurance_company=self.insurance_company,
            insurance_type=self.insurance_type,
            client=self.client_entity,
        )
        self.payment = Payment.objects.create(
            policy=self.policy,
            deal=self.deal,
            amount=2000,
            description="Payment for financial record delete tests",
            scheduled_date=date(2026, 6, 10),
            actual_date=None,
        )

    def _delete_record(self, record_id):
        self.authenticate(self.seller)
        return self.api_client.delete(f"/api/v1/financial_records/{record_id}/")

    def test_delete_financial_record_without_statement(self):
        record = FinancialRecord.objects.create(
            payment=self.payment,
            amount=250,
            record_type=FinancialRecord.RecordType.INCOME,
            date=None,
            note="Standalone record",
        )

        response = self._delete_record(record.id)

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_delete_financial_record_from_draft_statement_is_blocked(self):
        statement = Statement.objects.create(
            name="Draft statement",
            statement_type=Statement.TYPE_INCOME,
            paid_at=None,
        )
        record = FinancialRecord.objects.create(
            payment=self.payment,
            statement=statement,
            amount=250,
            record_type=FinancialRecord.RecordType.INCOME,
            date=None,
            note="Draft statement record",
        )

        response = self._delete_record(record.id)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            response.json()[0],
            "Нельзя удалить запись из ведомости. Сначала уберите её из состава ведомости.",
        )

    def test_delete_financial_record_from_paid_statement_is_blocked(self):
        statement = Statement.objects.create(
            name="Paid statement",
            statement_type=Statement.TYPE_INCOME,
            paid_at=date(2026, 6, 11),
            status=Statement.STATUS_PAID,
        )
        record = FinancialRecord.objects.create(
            payment=self.payment,
            statement=statement,
            amount=250,
            record_type=FinancialRecord.RecordType.INCOME,
            date=date(2026, 6, 11),
            note="Paid statement record",
        )

        response = self._delete_record(record.id)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            response.json()[0],
            "Нельзя удалить запись из выплаченной ведомости.",
        )
