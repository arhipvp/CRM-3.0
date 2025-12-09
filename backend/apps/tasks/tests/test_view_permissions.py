from apps.clients.models import Client
from apps.common.tests.auth_utils import AuthenticatedAPITestCase
from apps.deals.models import Deal
from apps.tasks.models import Task
from apps.users.models import Role, UserRole
from django.contrib.auth.models import User
from rest_framework import status


class TaskPermissionsTests(AuthenticatedAPITestCase):
    """Убедиться, что только владелец сделки и админ могут удалять задачи."""

    def setUp(self):
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
            {"status": Task.TaskStatus.DONE},
            format="json",
        )

        self.task.refresh_from_db()

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(self.task.status, Task.TaskStatus.DONE)
        self.assertEqual(self.task.completed_by_id, self.executor.id)
        self.assertIsNotNone(self.task.completed_at)
