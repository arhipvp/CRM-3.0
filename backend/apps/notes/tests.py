from apps.clients.models import Client
from apps.common.tests.auth_utils import AuthenticatedAPITestCase
from apps.deals.models import Deal
from apps.notes.models import Note
from apps.users.models import Role, UserRole
from django.contrib.auth.models import User
from rest_framework import status


class NoteCreationPermissionsTests(AuthenticatedAPITestCase):
    """Проверки прав на создание и удаление заметок в сделке."""

    def setUp(self):
        super().setUp()
        self.seller_user = User.objects.create_user(
            username="seller", password="strongpass"
        )
        self.executor_user = User.objects.create_user(
            username="second", password="strongpass"
        )
        self.unrelated_user = User.objects.create_user(
            username="third", password="strongpass"
        )

        self.client_record = Client.objects.create(
            name="Test Client", phone="+1234567890", birth_date="1990-01-01"
        )
        self.deal = Deal.objects.create(
            title="Deal for Notes",
            client=self.client_record,
            seller=self.seller_user,
            executor=self.executor_user,
            status="open",
            stage_name="initial",
        )

        self.admin_user = User.objects.create_user(
            username="admin", password="strongpass"
        )
        admin_role, _ = Role.objects.get_or_create(
            name="Admin", defaults={"description": "Default admin role"}
        )
        UserRole.objects.create(user=self.admin_user, role=admin_role)

    def _payload(self) -> dict:
        return {"deal": self.deal.id, "body": "Привет от продавца"}

    def test_seller_can_create_note(self):
        self.authenticate(self.seller_user)
        response = self.api_client.post(
            "/api/v1/notes/", self._payload(), format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Note.objects.filter(deal=self.deal).count(), 1)
        self.assertEqual(response.data["body"], "Привет от продавца")

    def test_executor_can_create_note(self):
        self.authenticate(self.executor_user)
        response = self.api_client.post(
            "/api/v1/notes/", self._payload(), format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Note.objects.filter(deal=self.deal).count(), 1)
        self.assertEqual(response.data["author_name"], "second")

    def test_unrelated_user_cannot_create_note(self):
        self.authenticate(self.unrelated_user)
        response = self.api_client.post(
            "/api/v1/notes/", self._payload(), format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("владелец сделки", response.data["detail"])
        self.assertEqual(Note.objects.filter(deal=self.deal).count(), 0)

    def test_seller_can_delete_note(self):
        note = Note.objects.create(
            deal=self.deal,
            body="deletable note",
            author_name="second",
            author=self.executor_user,
        )
        self.authenticate(self.seller_user)

        response = self.api_client.delete(f"/api/v1/notes/{note.id}/")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        deleted_note = Note.objects.with_deleted().get(id=note.id)
        self.assertIsNotNone(deleted_note.deleted_at)

    def test_executor_can_delete_own_note(self):
        note = Note.objects.create(
            deal=self.deal,
            body="executor note",
            author_name="second",
            author=self.executor_user,
        )
        self.authenticate(self.executor_user)

        response = self.api_client.delete(f"/api/v1/notes/{note.id}/")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertIsNotNone(Note.objects.with_deleted().get(id=note.id).deleted_at)

    def test_executor_cannot_delete_other_note(self):
        note = Note.objects.create(
            deal=self.deal,
            body="other user note",
            author_name="Seller",
            author=self.seller_user,
        )
        self.authenticate(self.executor_user)

        response = self.api_client.delete(f"/api/v1/notes/{note.id}/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIsNone(Note.objects.with_deleted().get(id=note.id).deleted_at)

    def test_admin_can_delete_note(self):
        note = Note.objects.create(
            deal=self.deal, body="admin deletes this", author_name="Admin"
        )
        self.authenticate(self.admin_user)

        response = self.api_client.delete(f"/api/v1/notes/{note.id}/")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertIsNotNone(Note.objects.with_deleted().get(id=note.id).deleted_at)
