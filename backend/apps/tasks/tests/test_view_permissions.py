from datetime import timedelta

from apps.clients.models import Client
from apps.common.tests.auth_utils import AuthenticatedAPITestCase
from apps.deals.models import Deal
from apps.tasks.models import Task
from apps.users.models import Role, UserRole
from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework import status


class TaskPermissionsTests(AuthenticatedAPITestCase):
    """Убедиться, что только владелец сделки и админ могут удалять задачи."""

    def setUp(self):
        super().setUp()
        self.seller = User.objects.create_user(username="seller", password="pass")
        self.executor = User.objects.create_user(username="executor", password="pass")
        self.other_user = User.objects.create_user(username="other", password="pass")
        self.admin = User.objects.create_user(username="admin", password="pass")

        client = Client.objects.create(name="Task Client")
        self.deal = Deal.objects.create(
            title="Deal for Tasks",
            client=client,
            seller=self.seller,
            executor=self.executor,
            status="open",
            stage_name="initial",
        )

        admin_role = Role.objects.create(name="Admin")
        UserRole.objects.create(user=self.admin, role=admin_role)

        self.token_for(self.seller)
        self.token_for(self.executor)
        self.token_for(self.admin)

        self.task = Task.objects.create(
            deal=self.deal,
            title="Review contract",
            created_by=self.other_user,
        )

    def _delete_task(self, user: User):
        self.authenticate(user)
        return self.api_client.delete(f"/api/v1/tasks/{self.task.id}/")

    def test_seller_can_delete_task(self):
        response = self._delete_task(self.seller)

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        deleted_task = Task.objects.with_deleted().get(id=self.task.id)
        self.assertIsNotNone(deleted_task.deleted_at)

    def test_executor_cannot_delete_task(self):
        response = self._delete_task(self.executor)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIsNone(Task.objects.get(id=self.task.id).deleted_at)

    def test_admin_can_delete_task(self):
        response = self._delete_task(self.admin)

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        deleted_task = Task.objects.with_deleted().get(id=self.task.id)
        self.assertIsNotNone(deleted_task.deleted_at)

    def test_executor_can_mark_task_as_done(self):
        self.task.assignee = self.executor
        self.task.save(update_fields=["assignee"])

        self.authenticate(self.executor)
        response = self.api_client.patch(
            f"/api/v1/tasks/{self.task.id}/",
            {
                "status": Task.TaskStatus.DONE,
                "completion_comment": "  Готово, документы проверены.  ",
            },
            format="json",
        )

        self.task.refresh_from_db()

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(self.task.status, Task.TaskStatus.DONE)
        self.assertEqual(self.task.completed_by_id, self.executor.id)
        self.assertIsNotNone(self.task.completed_at)
        self.assertEqual(self.task.completion_comment, "Готово, документы проверены.")
        self.assertEqual(
            response.data["completion_comment"], "Готово, документы проверены."
        )

    def test_reopening_task_clears_completion_comment(self):
        self.task.assignee = self.executor
        self.task.status = Task.TaskStatus.DONE
        self.task.completed_by = self.executor
        self.task.completed_at = timezone.now()
        self.task.completion_comment = "Выполнено с комментарием"
        self.task.save(
            update_fields=[
                "assignee",
                "status",
                "completed_by",
                "completed_at",
                "completion_comment",
            ]
        )

        self.authenticate(self.seller)
        response = self.api_client.patch(
            f"/api/v1/tasks/{self.task.id}/",
            {"status": Task.TaskStatus.TODO},
            format="json",
        )

        self.task.refresh_from_db()

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(self.task.status, Task.TaskStatus.TODO)
        self.assertIsNone(self.task.completed_by)
        self.assertIsNone(self.task.completed_at)
        self.assertEqual(self.task.completion_comment, "")

    def test_deleted_tasks_hidden_by_default(self):
        self._delete_task(self.seller)

        self.authenticate(self.seller)
        response = self.api_client.get("/api/v1/tasks/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.data.get("results", response.data)
        returned_ids = {item["id"] for item in payload}
        self.assertNotIn(str(self.task.id), returned_ids)

    def test_deleted_tasks_visible_with_show_deleted(self):
        self._delete_task(self.seller)

        self.authenticate(self.seller)
        response = self.api_client.get("/api/v1/tasks/?show_deleted=true")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.data.get("results", response.data)
        returned_ids = {item["id"] for item in payload}
        self.assertIn(str(self.task.id), returned_ids)

    def test_assignee_sees_task_even_if_not_related_to_deal(self):
        foreign_client = Client.objects.create(name="Foreign Client")
        foreign_deal = Deal.objects.create(
            title="Foreign Deal",
            client=foreign_client,
            seller=self.other_user,
            executor=self.other_user,
            status="open",
            stage_name="initial",
        )
        assigned_task = Task.objects.create(
            deal=foreign_deal,
            title="Assigned externally",
            assignee=self.executor,
            created_by=self.other_user,
        )

        self.authenticate(self.executor)
        response = self.api_client.get("/api/v1/tasks/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.data.get("results", response.data)
        returned_ids = {item["id"] for item in payload}
        self.assertIn(str(assigned_task.id), returned_ids)

    def test_tasks_default_to_priority_then_due_date_then_created_at(self):
        now = timezone.now()
        urgent_later = Task.objects.create(
            deal=self.deal,
            title="Urgent later",
            priority=Task.PriorityChoices.URGENT,
            due_at=now + timedelta(days=3),
            created_by=self.seller,
        )
        urgent_sooner = Task.objects.create(
            deal=self.deal,
            title="Urgent sooner",
            priority=Task.PriorityChoices.URGENT,
            due_at=now + timedelta(days=1),
            created_by=self.seller,
        )
        high_task = Task.objects.create(
            deal=self.deal,
            title="High priority",
            priority=Task.PriorityChoices.HIGH,
            due_at=now + timedelta(days=1),
            created_by=self.seller,
        )

        self.authenticate(self.seller)
        response = self.api_client.get("/api/v1/tasks/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.data.get("results", response.data)
        returned_ids = [item["id"] for item in payload]
        urgent_later_index = returned_ids.index(str(urgent_later.id))
        urgent_sooner_index = returned_ids.index(str(urgent_sooner.id))
        high_task_index = returned_ids.index(str(high_task.id))

        self.assertLess(urgent_sooner_index, urgent_later_index)
        self.assertLess(urgent_later_index, high_task_index)

    def test_tasks_support_explicit_priority_ordering(self):
        low_task = Task.objects.create(
            deal=self.deal,
            title="Low priority",
            priority=Task.PriorityChoices.LOW,
            created_by=self.seller,
        )
        urgent_task = Task.objects.create(
            deal=self.deal,
            title="Urgent priority",
            priority=Task.PriorityChoices.URGENT,
            created_by=self.seller,
        )

        self.authenticate(self.seller)
        response = self.api_client.get("/api/v1/tasks/?ordering=-priority")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.data.get("results", response.data)
        returned_ids = [item["id"] for item in payload]

        self.assertLess(
            returned_ids.index(str(urgent_task.id)),
            returned_ids.index(str(low_task.id)),
        )
