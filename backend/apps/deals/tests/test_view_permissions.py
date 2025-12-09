from datetime import date

from apps.clients.models import Client
from apps.common.tests.auth_utils import AuthenticatedAPITestCase
from apps.deals.models import Deal
from apps.tasks.models import Task
from apps.users.models import Permission, Role, RolePermission, UserRole
from django.contrib.auth.models import User
from rest_framework import status


class DealUpdatePermissionsTests(AuthenticatedAPITestCase):
    """Проверяет, что обновление сделки доступно продавцу и администратору."""

    def setUp(self):
        super().setUp()
        self.seller = User.objects.create_user(username="seller", password="pass")
        self.other_user = User.objects.create_user(username="other", password="pass")
        self.admin_user = User.objects.create_user(username="admin", password="pass")
        self.client_record = Client.objects.create(name="Client")
        self.deal = Deal.objects.create(
            title="Permission Deal",
            client=self.client_record,
            seller=self.seller,
            status="open",
            stage_name="initial",
        )

        admin_role, _ = Role.objects.get_or_create(
            name="Admin",
            defaults={"description": "Системный администратор"},
        )
        UserRole.objects.create(user=self.admin_user, role=admin_role)

        self.token_for(self.seller)
        self.token_for(self.other_user)
        self.token_for(self.admin_user)

    def _patch_expected_close(self, user: User, new_date: date):
        self.authenticate(user)
        return self.api_client.patch(
            f"/api/v1/deals/{self.deal.id}/",
            {"expected_close": new_date.isoformat()},
            format="json",
        )

    def test_seller_can_update_expected_close(self):
        response = self._patch_expected_close(self.seller, date(2025, 12, 31))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.deal.refresh_from_db()
        self.assertEqual(self.deal.expected_close, date(2025, 12, 31))

    def test_non_seller_cannot_update_deal(self):
        response = self._patch_expected_close(self.other_user, date(2025, 12, 31))

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.deal.refresh_from_db()
        self.assertIsNone(self.deal.expected_close)

    def test_admin_can_update_any_deal(self):
        response = self._patch_expected_close(self.admin_user, date(2025, 12, 31))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.deal.refresh_from_db()
        self.assertEqual(self.deal.expected_close, date(2025, 12, 31))

    def _extract_deal_ids(self, response):
        data = response.data
        if isinstance(data, dict):
            data = data.get("results", [])
        return [deal["id"] for deal in data]

    def test_role_with_deal_view_permission_still_needs_assignment(self):
        observer_role = Role.objects.create(name="Observer")
        view_permission = Permission.objects.create(resource="deal", action="view")
        RolePermission.objects.create(role=observer_role, permission=view_permission)
        observer = User.objects.create_user(username="observer", password="pass")
        UserRole.objects.create(user=observer, role=observer_role)
        extra_deal = Deal.objects.create(
            title="Other Deal",
            client=self.client_record,
            seller=self.admin_user,
            executor=self.admin_user,
            status="open",
            stage_name="initial",
        )

        self.authenticate(observer)

        response = self.api_client.get("/api/v1/deals/", format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        deal_ids = self._extract_deal_ids(response)
        self.assertNotIn(str(self.deal.id), deal_ids)
        self.assertNotIn(str(extra_deal.id), deal_ids)

    def test_user_assigned_to_task_sees_related_deal(self):
        observer_role = Role.objects.create(name="ObserverTask")
        view_permission = Permission.objects.create(resource="deal", action="view")
        RolePermission.objects.create(role=observer_role, permission=view_permission)
        observer = User.objects.create_user(username="observer_task", password="pass")
        UserRole.objects.create(user=observer, role=observer_role)
        Task.objects.create(
            title="Follow-up",
            deal=self.deal,
            assignee=observer,
        )

        self.authenticate(observer)

        response = self.api_client.get("/api/v1/deals/", format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        deal_ids = self._extract_deal_ids(response)
        self.assertIn(str(self.deal.id), deal_ids)
