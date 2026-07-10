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

    def test_create_task_requires_assignee_when_deal_has_no_executor(self):
        deal_without_executor = Deal.objects.create(
            title="Deal without executor",
            client=self.deal.client,
            seller=self.seller,
            status="open",
            stage_name="initial",
        )

        self.authenticate(self.seller)
        response = self.api_client.post(
            "/api/v1/tasks/",
            {
                "deal": str(deal_without_executor.id),
                "title": "Task without assignee",
                "priority": Task.PriorityChoices.NORMAL,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("assignee", response.data)

    def test_create_task_uses_deal_executor_when_assignee_omitted(self):
        self.authenticate(self.seller)
        response = self.api_client.post(
            "/api/v1/tasks/",
            {
                "deal": str(self.deal.id),
                "title": "Task with fallback assignee",
                "priority": Task.PriorityChoices.NORMAL,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created_task = Task.objects.get(id=response.data["id"])
        self.assertEqual(created_task.assignee_id, self.executor.id)

    def test_create_task_uses_deal_executor_when_assignee_is_null(self):
        self.authenticate(self.seller)
        response = self.api_client.post(
            "/api/v1/tasks/",
            {
                "deal": str(self.deal.id),
                "title": "Task with null assignee",
                "priority": Task.PriorityChoices.NORMAL,
                "assignee": None,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created_task = Task.objects.get(id=response.data["id"])
        self.assertEqual(created_task.assignee_id, self.executor.id)

    def test_update_task_rejects_clearing_assignee(self):
        self.task.assignee = self.executor
        self.task.save(update_fields=["assignee"])

        self.authenticate(self.seller)
        response = self.api_client.patch(
            f"/api/v1/tasks/{self.task.id}/",
            {"assignee": None},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("assignee", response.data)

    def test_update_task_without_assignee_field_is_allowed(self):
        self.authenticate(self.seller)
        response = self.api_client.patch(
            f"/api/v1/tasks/{self.task.id}/",
            {"title": "Updated title"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.task.refresh_from_db()
        self.assertEqual(self.task.title, "Updated title")

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

    def test_active_only_returns_only_unfinished_statuses(self):
        tasks_by_status = {
            task_status: Task.objects.create(
                deal=self.deal,
                title=f"Task {task_status}",
                status=task_status,
                created_by=self.seller,
            )
            for task_status in Task.TaskStatus.values
        }

        self.authenticate(self.seller)
        response = self.api_client.get("/api/v1/tasks/?active_only=true&page_size=500")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        returned_ids = {item["id"] for item in response.data["results"]}
        self.assertIn(str(tasks_by_status[Task.TaskStatus.TODO].id), returned_ids)
        self.assertIn(
            str(tasks_by_status[Task.TaskStatus.IN_PROGRESS].id), returned_ids
        )
        self.assertIn(str(tasks_by_status[Task.TaskStatus.OVERDUE].id), returned_ids)
        self.assertNotIn(str(tasks_by_status[Task.TaskStatus.DONE].id), returned_ids)
        self.assertNotIn(
            str(tasks_by_status[Task.TaskStatus.CANCELED].id), returned_ids
        )

    def test_list_uses_compact_checklist_contract_by_default(self):
        self.task.checklist = [
            {"text": "Первый пункт", "done": True},
            {"text": "Второй пункт", "done": False},
        ]
        self.task.save(update_fields=["checklist"])

        self.authenticate(self.seller)
        response = self.api_client.get("/api/v1/tasks/?active_only=true")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        returned_task = next(
            item for item in response.data["results"] if item["id"] == str(self.task.id)
        )
        self.assertNotIn("checklist", returned_task)
        self.assertEqual(returned_task["checklist_count"], 2)

    def test_list_can_explicitly_include_full_checklist(self):
        self.task.checklist = [{"text": "Пункт", "done": False}]
        self.task.save(update_fields=["checklist"])

        self.authenticate(self.seller)
        response = self.api_client.get(
            "/api/v1/tasks/?active_only=true&include_checklist=true"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        returned_task = next(
            item for item in response.data["results"] if item["id"] == str(self.task.id)
        )
        self.assertEqual(returned_task["checklist"], self.task.checklist)
        self.assertNotIn("checklist_count", returned_task)

    def test_task_page_size_is_capped_at_500(self):
        Task.objects.bulk_create(
            [
                Task(
                    deal=self.deal,
                    title=f"Bulk task {index}",
                    created_by=self.seller,
                )
                for index in range(500)
            ]
        )

        self.authenticate(self.seller)
        response = self.api_client.get("/api/v1/tasks/?page_size=999")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 501)
        self.assertEqual(len(response.data["results"]), 500)

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

    def test_tasks_default_to_priority_then_created_at(self):
        now = timezone.now()
        urgent_newer = Task.objects.create(
            deal=self.deal,
            title="Urgent newer",
            priority=Task.PriorityChoices.URGENT,
            due_at=now + timedelta(days=1),
            created_by=self.seller,
        )
        urgent_older = Task.objects.create(
            deal=self.deal,
            title="Urgent older",
            priority=Task.PriorityChoices.URGENT,
            due_at=now + timedelta(days=3),
            created_by=self.seller,
        )
        high_task = Task.objects.create(
            deal=self.deal,
            title="High priority",
            priority=Task.PriorityChoices.HIGH,
            due_at=now + timedelta(days=1),
            created_by=self.seller,
        )
        Task.objects.filter(id=urgent_older.id).update(
            created_at=now - timedelta(days=2)
        )
        Task.objects.filter(id=urgent_newer.id).update(
            created_at=now - timedelta(days=1)
        )
        Task.objects.filter(id=high_task.id).update(created_at=now - timedelta(days=3))

        self.authenticate(self.seller)
        response = self.api_client.get("/api/v1/tasks/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.data.get("results", response.data)
        returned_ids = [item["id"] for item in payload]
        urgent_older_index = returned_ids.index(str(urgent_older.id))
        urgent_newer_index = returned_ids.index(str(urgent_newer.id))
        high_task_index = returned_ids.index(str(high_task.id))

        self.assertLess(urgent_older_index, urgent_newer_index)
        self.assertLess(urgent_newer_index, high_task_index)

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
