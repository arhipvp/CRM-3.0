from apps.clients.models import Client
from apps.deals.models import Deal
from apps.finances.models import FinancialRecord, Payment
from apps.policies.models import Policy
from apps.tasks.models import Task
from django.test import TestCase


class DealDeletionCascadeTests(TestCase):
    def setUp(self):
        self.client_obj = Client.objects.create(name="Cascade Client")
        self.deal = Deal.objects.create(
            title="Cascade Deal",
            client=self.client_obj,
        )

    def test_deleting_deal_soft_deletes_policies_payments_and_finances(self):
        policy = Policy.objects.create(deal=self.deal, number="CASCADE-1")
        payment = Payment.objects.create(
            policy=policy, deal=self.deal, amount=500.0, description="Cascade premium"
        )
        record = FinancialRecord.objects.create(
            payment=payment, amount=500.0, description="Cascade income"
        )
        task = Task.objects.create(deal=self.deal, title="Cascade Task")

        self.deal.delete()

        self.deal.refresh_from_db()
        self.assertIsNotNone(self.deal.deleted_at)

        deleted_policy = Policy.objects.with_deleted().get(id=policy.id)
        deleted_payment = Payment.objects.with_deleted().get(id=payment.id)
        deleted_record = FinancialRecord.objects.with_deleted().get(id=record.id)

        self.assertIsNotNone(deleted_policy.deleted_at)
        self.assertIsNotNone(deleted_payment.deleted_at)
        self.assertIsNotNone(deleted_record.deleted_at)

        task.refresh_from_db()
        self.assertIsNone(task.deleted_at)
