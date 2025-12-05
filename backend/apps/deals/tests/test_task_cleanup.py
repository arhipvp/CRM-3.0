from apps.clients.models import Client
from apps.deals.models import Deal
from apps.tasks.models import Task
from django.contrib.auth.models import User
from django.test import TestCase


class DealTaskCascadeDeletionTests(TestCase):
    def test_tasks_remain_after_deal_deleted(self):
        seller = User.objects.create_user(username="task-seller", password="pass")
        client = Client.objects.create(name="Task Cascade Client")
        deal = Deal.objects.create(
            title="Cascade Deal",
            client=client,
            seller=seller,
            status="open",
            stage_name="initial",
        )
        task = Task.objects.create(deal=deal, title="Follow up")

        deal.delete()

        task.refresh_from_db()
        self.assertIsNone(task.deleted_at)
        self.assertEqual(Task.objects.filter(deal=deal).count(), 1)
