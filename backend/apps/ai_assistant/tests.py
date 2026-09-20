from unittest.mock import patch

from django.contrib.auth.models import User
from rest_framework.test import APITestCase


class FakeAssistantService:
    def __init__(self, user_id):
        self.user_id = user_id

    def request(self, method, path, **kwargs):
        return {"method": method, "path": path, "user_id": self.user_id, **kwargs}


class AssistantProxyPermissionsTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="manager", password="pass")
        self.vova = User.objects.create_user(username="Vova", password="pass")
        self.client.force_authenticate(self.user)

    @patch("apps.ai_assistant.views.AssistantService", FakeAssistantService)
    def test_conversations_are_proxied_with_authenticated_user_id(self):
        response = self.client.get("/api/v1/ai/conversations/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["user_id"], self.user.id)
        self.assertEqual(response.data["path"], "/api/conversations")

    def test_regular_user_cannot_upload_or_delete_documents(self):
        upload = self.client.post("/api/v1/ai/documents/", {})
        delete = self.client.delete("/api/v1/ai/documents/document-id/")
        self.assertEqual(upload.status_code, 403)
        self.assertEqual(delete.status_code, 403)

    @patch("apps.ai_assistant.views.AssistantService", FakeAssistantService)
    def test_vova_can_manage_library(self):
        self.client.force_authenticate(self.vova)
        response = self.client.delete("/api/v1/ai/documents/document-id/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["user_id"], self.vova.id)
