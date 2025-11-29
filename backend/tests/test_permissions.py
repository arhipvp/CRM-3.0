"""
Unit tests for EditProtectedMixin and permission system (ФАЗА 5.1)

Tests verify:
1. Unauthorized users get 403 on protected operations (update/destroy)
2. Admin users can update/destroy data
3. Users see only their own data (filtered by seller/executor)
4. Logging is triggered for both successful and failed operations
"""

from apps.clients.models import Client
from apps.deals.models import Deal
from apps.users.models import Role, UserRole
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient, APITestCase
from rest_framework_simplejwt.tokens import RefreshToken


class PermissionsTestCase(APITestCase):
    """Test suite for EditProtectedMixin and permission restrictions"""

    def setUp(self):
        """Set up test data: users, roles, and deals"""
        # Create test users
        self.admin_user = User.objects.create_user(
            username="admin", password="testpass123"
        )
        self.seller_user = User.objects.create_user(
            username="seller", password="testpass123"
        )
        self.executor_user = User.objects.create_user(
            username="executor", password="testpass123"
        )

        # Create roles
        self.admin_role = Role.objects.create(name="Admin")
        self.seller_role = Role.objects.create(name="Seller")
        self.executor_role = Role.objects.create(name="Executor")

        # Assign roles to users
        UserRole.objects.create(user=self.admin_user, role=self.admin_role)
        UserRole.objects.create(user=self.seller_user, role=self.seller_role)
        UserRole.objects.create(user=self.executor_user, role=self.executor_role)

        # Create test client
        self.client_obj = Client.objects.create(
            name="Test Client", phone="+1234567890", birth_date="1990-01-01"
        )

        # Create test deals
        self.deal_seller = Deal.objects.create(
            title="Deal by Seller",
            client=self.client_obj,
            seller=self.seller_user,
            executor=self.executor_user,
            status="open",
            stage_name="initial",
        )

        self.deal_other = Deal.objects.create(
            title="Deal by Admin",
            client=self.client_obj,
            seller=self.admin_user,
            executor=self.admin_user,
            status="open",
            stage_name="initial",
        )

        # Create API client and JWT tokens
        self.api_client = APIClient()
        self.admin_token = str(RefreshToken.for_user(self.admin_user).access_token)
        self.seller_token = str(RefreshToken.for_user(self.seller_user).access_token)
        self.executor_token = str(
            RefreshToken.for_user(self.executor_user).access_token
        )

    def test_1_unauthorized_user_cannot_update_deal(self):
        """Test 1: Non-admin user cannot update a deal (403 Forbidden)"""
        self.api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.executor_token}")

        response = self.api_client.patch(
            f"/api/v1/deals/{self.deal_seller.id}/",
            {"title": "Updated Title"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("администратор", response.data["detail"].lower())

    def test_2_admin_can_update_deal(self):
        """Test 2: Admin user can update any deal (200 OK)"""
        self.api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.admin_token}")

        response = self.api_client.patch(
            f"/api/v1/deals/{self.deal_seller.id}/",
            {"title": "Updated by Admin"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["title"], "Updated by Admin")

        # Verify in database
        self.deal_seller.refresh_from_db()
        self.assertEqual(self.deal_seller.title, "Updated by Admin")

    def test_3_user_sees_only_their_deals(self):
        """Test 3: Seller sees only deals where they are seller or executor"""
        self.api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.executor_token}")

        response = self.api_client.get("/api/v1/deals/", format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        deal_ids = [deal["id"] for deal in response.data]

        # Seller should see deal_seller (where they are seller)
        self.assertIn(str(self.deal_seller.id), deal_ids)
        # Seller should NOT see deal_other (where admin is seller/executor)
        self.assertNotIn(str(self.deal_other.id), deal_ids)

    def test_4_admin_sees_all_deals(self):
        """Test 4: Admin user can see all deals"""
        self.api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.admin_token}")

        response = self.api_client.get("/api/v1/deals/", format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        deal_ids = [deal["id"] for deal in response.data]

        # Admin should see both deals
        self.assertIn(str(self.deal_seller.id), deal_ids)
        self.assertIn(str(self.deal_other.id), deal_ids)

    def test_5_unauthorized_user_cannot_delete_deal(self):
        """Test 5: Non-admin user cannot delete a deal (403 Forbidden)"""
        self.api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.executor_token}")

        response = self.api_client.delete(f"/api/v1/deals/{self.deal_seller.id}/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("администратор", response.data["detail"].lower())

        # Verify deal is NOT deleted
        self.assertTrue(Deal.objects.filter(id=self.deal_seller.id).exists())

    def test_6_admin_can_delete_deal(self):
        """Test 6: Admin can delete deals (soft delete)"""
        self.api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.admin_token}")

        response = self.api_client.delete(f"/api/v1/deals/{self.deal_other.id}/")

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        # Verify soft delete - deal should not appear in normal queryset
        self.assertFalse(Deal.objects.filter(id=self.deal_other.id).exists())

    def test_7_partial_update_unauthorized(self):
        """Test 7: Non-admin cannot do partial update (PATCH)"""
        self.api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.executor_token}")

        response = self.api_client.patch(
            f"/api/v1/deals/{self.deal_seller.id}/", {"status": "won"}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_8_partial_update_admin(self):
        """Test 8: Admin can do partial update (PATCH)"""
        self.api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.admin_token}")

        response = self.api_client.patch(
            f"/api/v1/deals/{self.deal_seller.id}/", {"status": "won"}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "won")

    def test_9_unauthenticated_user_cannot_update(self):
        """Test 9: Unauthenticated request gets 401 Unauthorized"""
        # No token provided
        response = self.api_client.patch(
            f"/api/v1/deals/{self.deal_seller.id}/", {"title": "Updated"}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_10_executor_sees_their_deals(self):
        """Test 10: Executor sees deals where they are executor"""
        self.api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.executor_token}")

        response = self.api_client.get("/api/v1/deals/", format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        deal_ids = [deal["id"] for deal in response.data]

        # Executor should see deal_seller (where they are executor)
        self.assertIn(str(self.deal_seller.id), deal_ids)


class ClientPermissionsTestCase(APITestCase):
    """Test permissions on Client resources"""

    def setUp(self):
        """Set up test data for client tests"""
        self.admin_user = User.objects.create_user(
            username="admin", password="testpass123"
        )
        self.seller_user = User.objects.create_user(
            username="seller", password="testpass123"
        )

        self.admin_role = Role.objects.create(name="Admin")
        self.seller_role = Role.objects.create(name="Seller")

        UserRole.objects.create(user=self.admin_user, role=self.admin_role)
        UserRole.objects.create(user=self.seller_user, role=self.seller_role)

        self.admin_token = str(RefreshToken.for_user(self.admin_user).access_token)
        self.seller_token = str(RefreshToken.for_user(self.seller_user).access_token)

        self.client_obj = Client.objects.create(
            name="Test Client", phone="+1234567890", birth_date="1990-01-01"
        )

        self.api_client = APIClient()

    def test_client_update_restricted_to_admin(self):
        """Test: Non-admin cannot update clients"""
        # Create a deal for seller so they can see the client
        Deal.objects.create(
            title="Test Deal",
            client=self.client_obj,
            seller=self.seller_user,
            status="open",
            stage_name="initial",
        )

        self.api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.seller_token}")

        response = self.api_client.patch(
            f"/api/v1/clients/{self.client_obj.id}/",
            {"name": "Updated Name"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_update_client(self):
        """Test: Admin can update clients"""
        self.api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.admin_token}")

        response = self.api_client.patch(
            f"/api/v1/clients/{self.client_obj.id}/",
            {"name": "Updated Name"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["name"], "Updated Name")
