from datetime import date

from apps.clients.models import Client
from apps.common.tests.auth_utils import AuthenticatedAPITestCase
from apps.deals.models import Deal, InsuranceCompany, InsuranceType
from apps.finances.models import FinancialRecord, Payment
from apps.policies.models import Policy
from apps.users.models import Role, UserRole
from django.contrib.auth.models import User
from rest_framework import status


class PolicyDeleteRulesTests(AuthenticatedAPITestCase):
    def setUp(self):
        super().setUp()
        self.seller = User.objects.create_user(username="seller_delete", password="pass")
        self.other_user = User.objects.create_user(username="other_delete", password="pass")
        self.admin_user = User.objects.create_user(username="admin_delete", password="pass")
        self.client_entity = Client.objects.create(name="Delete Rules Client")
        self.deal = Deal.objects.create(
            title="Delete Rules Deal",
            client=self.client_entity,
            seller=self.seller,
            status="open",
            stage_name="initial",
        )
        self.insurance_company = InsuranceCompany.objects.create(
            name="Delete Rules Company",
            description="Company for delete rules tests",
        )
        self.insurance_type = InsuranceType.objects.create(
            name="Delete Rules Type",
            description="Type for delete rules tests",
        )
        admin_role, _ = Role.objects.get_or_create(
            name="Admin",
            defaults={"description": "Administrator role"},
        )
        UserRole.objects.create(user=self.admin_user, role=admin_role)

    def _create_policy(self, number: str) -> Policy:
        return Policy.objects.create(
            number=number,
            deal=self.deal,
            insurance_company=self.insurance_company,
            insurance_type=self.insurance_type,
            client=self.client_entity,
        )

    def _delete_policy(self, user: User, policy_id) -> object:
        self.authenticate(user)
        return self.api_client.delete(f"/api/v1/policies/{policy_id}/")

    def test_seller_can_delete_policy_without_paid_entities(self):
        policy = self._create_policy("DELETE-RULE-001")
        payment = Payment.objects.create(
            policy=policy,
            deal=self.deal,
            amount=1000,
            description="Unpaid payment",
            scheduled_date=date(2026, 1, 10),
            actual_date=None,
        )
        FinancialRecord.objects.create(
            payment=payment,
            amount=150,
            record_type=FinancialRecord.RecordType.INCOME,
            date=None,
            note="Unpaid record",
        )

        response = self._delete_policy(self.seller, policy.id)

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertTrue(Policy.objects.with_deleted().filter(pk=policy.pk).exists())
        self.assertTrue(
            Payment.objects.with_deleted().filter(pk=payment.pk, deleted_at__isnull=False).exists()
        )

    def test_admin_can_delete_policy_without_paid_entities(self):
        policy = self._create_policy("DELETE-RULE-ADMIN-001")

        response = self._delete_policy(self.admin_user, policy.id)

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertTrue(Policy.objects.with_deleted().filter(pk=policy.pk).exists())

    def test_delete_policy_is_blocked_by_paid_payment(self):
        policy = self._create_policy("DELETE-RULE-PAID-PAYMENT")
        Payment.objects.create(
            policy=policy,
            deal=self.deal,
            amount=1500,
            description="Paid payment",
            scheduled_date=date(2026, 1, 10),
            actual_date=date(2026, 1, 12),
        )

        response = self._delete_policy(self.seller, policy.id)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            response.json().get("detail"),
            "Нельзя удалить полис: есть оплаченные платежи.",
        )
        self.assertIsNone(Policy.objects.with_deleted().get(pk=policy.pk).deleted_at)

    def test_delete_policy_is_blocked_by_paid_financial_record(self):
        policy = self._create_policy("DELETE-RULE-PAID-RECORD")
        payment = Payment.objects.create(
            policy=policy,
            deal=self.deal,
            amount=2000,
            description="Unpaid payment with paid record",
            scheduled_date=date(2026, 1, 20),
            actual_date=None,
        )
        FinancialRecord.objects.create(
            payment=payment,
            amount=250,
            record_type=FinancialRecord.RecordType.INCOME,
            date=date(2026, 1, 21),
            note="Paid record",
        )

        response = self._delete_policy(self.seller, policy.id)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            response.json().get("detail"),
            "Нельзя удалить полис: есть оплаченные финансовые записи.",
        )
        self.assertIsNone(Policy.objects.with_deleted().get(pk=policy.pk).deleted_at)

    def test_non_owner_cannot_delete_policy(self):
        policy = self._create_policy("DELETE-RULE-FORBIDDEN")

        response = self._delete_policy(self.other_user, policy.id)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIsNone(Policy.objects.with_deleted().get(pk=policy.pk).deleted_at)
