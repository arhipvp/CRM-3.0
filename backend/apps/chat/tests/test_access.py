from apps.chat.models import ChatMessage
from apps.clients.models import Client
from apps.deals.models import Deal
from apps.users.models import Role, UserRole
from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APIClient, APITestCase
from rest_framework_simplejwt.tokens import RefreshToken


class ChatMessageAccessTests(APITestCase):
    def setUp(self):
        self.client_record = Client.objects.create(name="Test Client")
        self.seller = User.objects.create_user(username="seller", password="pass")
        self.executor = User.objects.create_user(username="executor", password="pass")
        self.other_user = User.objects.create_user(username="other", password="pass")
        self.deal = Deal.objects.create(
            title="Deal One",
            client=self.client_record,
            seller=self.seller,
            executor=self.executor,
            status="open",
            stage_name="initial",
        )
        self.other_deal = Deal.objects.create(
            title="Deal Two",
            client=self.client_record,
            seller=self.seller,
            executor=self.executor,
            status="open",
            stage_name="initial",
        )
        self.deleted_deal = Deal.objects.create(
            title="Deal Deleted",
            client=self.client_record,
            seller=self.seller,
            executor=self.executor,
            status="open",
            stage_name="initial",
        )

        ChatMessage.objects.create(
            deal=self.deal,
            body="Message 1",
            author=self.seller,
            author_name="Seller",
        )
        ChatMessage.objects.create(
            deal=self.deal,
            body="Message 2",
            author=self.executor,
            author_name="Executor",
        )
        ChatMessage.objects.create(
            deal=self.other_deal,
            body="Other deal message",
            author=self.seller,
            author_name="Seller",
        )
        ChatMessage.objects.create(
            deal=self.deleted_deal,
            body="Deleted deal message",
            author=self.seller,
            author_name="Seller",
        )
        self.deleted_deal.delete()

        self.api_client = APIClient()
        self.seller_token = str(RefreshToken.for_user(self.seller).access_token)
        self.other_token = str(RefreshToken.for_user(self.other_user).access_token)
        self.admin_user = User.objects.create_user(username="admin", password="pass")
        admin_role, _ = Role.objects.get_or_create(name="Admin")
        UserRole.objects.create(user=self.admin_user, role=admin_role)
        self.admin_token = str(RefreshToken.for_user(self.admin_user).access_token)

    def _auth(self, token: str) -> None:
        self.api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    def _create_messages(
        self,
        deal: Deal,
        count: int,
        *,
        author=None,
        prefix="Message",
    ) -> None:
        """Seeds multiple chat messages for a deal."""
        sender = author or self.seller
        author_name = (sender.get_full_name() or sender.username).strip()
        for idx in range(count):
            ChatMessage.objects.create(
                deal=deal,
                body=f"{prefix} {idx + 1}",
                author=sender,
                author_name=author_name,
            )

    def test_messages_are_scoped_to_deal(self):
        self._auth(self.seller_token)
        response = self.api_client.get(f"/api/v1/chat_messages/?deal={self.deal.id}")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.data
        results = payload.get("results") if isinstance(payload, dict) else payload
        self.assertEqual(len(results), 2)
        self.assertTrue(
            all(message["deal"] == str(self.deal.id) for message in results)
        )

    def test_non_participant_cannot_create_message(self):
        self._auth(self.other_token)
        response = self.api_client.post(
            "/api/v1/chat_messages/",
            {"deal": str(self.deal.id), "body": "Hello"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_create_message_for_any_deal(self):
        self._auth(self.admin_token)
        response = self.api_client.post(
            "/api/v1/chat_messages/",
            {"deal": str(self.deal.id), "body": "Admin ping"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_deleted_deal_chat_is_visible(self):
        self._auth(self.seller_token)
        response = self.api_client.get(
            f"/api/v1/chat_messages/?deal={self.deleted_deal.id}"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.data
        results = payload.get("results") if isinstance(payload, dict) else payload
        self.assertEqual(len(results), 1)
        self.assertTrue(
            all(message["deal"] == str(self.deleted_deal.id) for message in results)
        )

    def test_cannot_create_message_for_deleted_deal(self):
        self._auth(self.seller_token)
        response = self.api_client.post(
            "/api/v1/chat_messages/",
            {"deal": str(self.deleted_deal.id), "body": "Hello deleted"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data.get("detail"), "Сделка удалена, чат недоступен")

    def test_chat_messages_pagination_limits_default_and_custom_page_size(self):
        self._create_messages(self.deal, 25, prefix="Paginated")
        self._auth(self.seller_token)

        response = self.api_client.get(f"/api/v1/chat_messages/?deal={self.deal.id}")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.data
        self.assertEqual(payload.get("count"), 27)
        self.assertEqual(len(payload["results"]), 20)
        self.assertIsNotNone(payload.get("next"))

        limited_response = self.api_client.get(
            f"/api/v1/chat_messages/?deal={self.deal.id}&limit=5"
        )
        limited_payload = limited_response.data
        self.assertEqual(limited_payload.get("count"), 27)
        self.assertEqual(len(limited_payload["results"]), 5)
        self.assertIsNotNone(limited_payload.get("next"))

    def test_deleted_deal_messages_remain_accessible_after_deletion(self):
        archived_deal = Deal.objects.create(
            title="Archived Deal",
            client=self.client_record,
            seller=self.seller,
            executor=self.executor,
            status="open",
            stage_name="initial",
        )
        self._create_messages(archived_deal, 3, prefix="Archived")
        archived_deal.delete()

        self._auth(self.seller_token)
        response = self.api_client.get(
            f"/api/v1/chat_messages/?deal={archived_deal.id}"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.data
        self.assertEqual(payload.get("count"), 3)
        bodies = [msg["body"] for msg in payload["results"]]
        self.assertTrue(all(body.startswith("Archived") for body in bodies))
