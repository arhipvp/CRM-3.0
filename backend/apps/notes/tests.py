from django.contrib.auth.models import User
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.test import APIClient, APITestCase

from apps.clients.models import Client
from apps.deals.models import Deal
from apps.notes.models import Note


class NoteCreationPermissionsTests(APITestCase):
    """Проверки на создание заметок только продавцом сделки."""

    def setUp(self):
        self.seller_user = User.objects.create_user(
            username="seller", password="strongpass"
        )
        self.other_user = User.objects.create_user(
            username="second", password="strongpass"
        )

        self.client_record = Client.objects.create(
            name="Test Client", phone="+1234567890", birth_date="1990-01-01"
        )
        self.deal = Deal.objects.create(
            title="Deal for Notes",
            client=self.client_record,
            seller=self.seller_user,
            executor=self.other_user,
            status="open",
            stage_name="initial",
        )

        self.api_client = APIClient()
        self.seller_token = str(RefreshToken.for_user(self.seller_user).access_token)
        self.other_token = str(RefreshToken.for_user(self.other_user).access_token)

    def _auth(self, token: str) -> None:
        self.api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    def _payload(self) -> dict:
        return {"deal": self.deal.id, "body": "Привет от продавца"}

    def test_seller_can_create_note(self):
        self._auth(self.seller_token)
        response = self.api_client.post(
            "/api/v1/notes/", self._payload(), format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Note.objects.filter(deal=self.deal).count(), 1)
        self.assertEqual(response.data["body"], "Привет от продавца")

    def test_non_seller_cannot_create_note(self):
        self._auth(self.other_token)
        response = self.api_client.post(
            "/api/v1/notes/", self._payload(), format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("владелец сделки", response.data["detail"])
        self.assertEqual(Note.objects.filter(deal=self.deal).count(), 0)
