from apps.clients.models import Client
from apps.deals.models import Deal
from apps.tasks.models import Task
from apps.users.models import Role, UserRole
from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APIClient, APITestCase
from rest_framework_simplejwt.tokens import RefreshToken


class TaskPermissionsTests(APITestCase):
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

        self.api_client = APIClient()
        self.seller_token = str(RefreshToken.for_user(self.seller).access_token)
        self.executor_token = str(RefreshToken.for_user(self.executor).access_token)
        self.admin_token = str(RefreshToken.for_user(self.admin).access_token)

        self.task = Task.objects.create(
            deal=self.deal,
            title="Review contract",
            created_by=self.other_user,
        )

    def _delete_task(self, token: str):
        self.api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        return self.api_client.delete(f"/api/v1/tasks/{self.task.id}/")

    def test_seller_can_delete_task(self):
        response = self._delete_task(self.seller_token)

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        deleted_task = Task.objects.with_deleted().get(id=self.task.id)
        self.assertIsNotNone(deleted_task.deleted_at)

    def test_executor_cannot_delete_task(self):
        response = self._delete_task(self.executor_token)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIsNone(Task.objects.get(id=self.task.id).deleted_at)

    def test_admin_can_delete_task(self):
        response = self._delete_task(self.admin_token)

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        deleted_task = Task.objects.with_deleted().get(id=self.task.id)
        self.assertIsNotNone(deleted_task.deleted_at)

    def test_executor_can_mark_task_as_done(self):
        self.task.assignee = self.executor
        self.task.save(update_fields=["assignee"])

        self.api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.executor_token}")
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
