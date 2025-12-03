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

        self.api_client = APIClient()
        self.seller_token = str(RefreshToken.for_user(self.seller).access_token)
        self.other_token = str(RefreshToken.for_user(self.other_user).access_token)
        self.admin_user = User.objects.create_user(username="admin", password="pass")
        admin_role, _ = Role.objects.get_or_create(name="Admin")
        UserRole.objects.create(user=self.admin_user, role=admin_role)
        self.admin_token = str(RefreshToken.for_user(self.admin_user).access_token)

    def _auth(self, token: str) -> None:
        self.api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    def test_messages_are_scoped_to_deal(self):
        self._auth(self.seller_token)
        response = self.api_client.get(
            f"/api/v1/chat_messages/?deal={self.deal.id}"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.data
        results = payload.get("results") if isinstance(payload, dict) else payload
        self.assertEqual(len(results), 2)
        self.assertTrue(all(message["deal"] == str(self.deal.id) for message in results))

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
