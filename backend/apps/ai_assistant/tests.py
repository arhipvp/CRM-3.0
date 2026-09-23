from __future__ import annotations

from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from .models import AiConversation, AiDocument, AiMessage, AiRun
from .worker import _finish, process_next_answer, recover_interrupted_runs


class DurableAnswerTests(APITestCase):
    def setUp(self):
        self.owner = get_user_model().objects.create_user(username="owner")
        self.other = get_user_model().objects.create_user(username="other")
        self.conversation = AiConversation.objects.create(
            owner=self.owner, model="test-model", scope=[{"insurer": "РЕСО"}]
        )
        self.url = f"/api/v1/ai/conversations/{self.conversation.id}/messages/"
        self.client.force_authenticate(self.owner)

    def submit(self, request_id="first"):
        return self.client.post(
            self.url,
            {
                "content": "Можно ли страховать таунхаус?",
                "client_request_id": request_id,
            },
            format="json",
        )

    def test_atomic_creation_idempotency_and_one_active_answer(self):
        first = self.submit()
        self.assertEqual(first.status_code, 202)
        run = AiRun.objects.get()
        self.assertEqual(run.scope, [{"insurer": "РЕСО"}])
        self.assertEqual(run.model, "test-model")
        self.assertEqual(AiMessage.objects.count(), 2)
        again = self.submit()
        self.assertEqual(again.status_code, 202)
        self.assertEqual(again.data["run_id"], first.data["run_id"])
        self.assertEqual(AiMessage.objects.count(), 2)
        blocked = self.submit("second")
        self.assertEqual(blocked.status_code, 409)
        self.assertEqual(AiMessage.objects.count(), 2)

    def test_owner_only_and_active_settings_lock(self):
        self.submit()
        update = self.client.patch(
            f"/api/v1/ai/conversations/{self.conversation.id}/",
            {"scope": []},
            format="json",
        )
        self.assertEqual(update.status_code, 409)
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get(self.url).status_code, 404)
        self.assertEqual(
            self.client.post(
                self.url, {"content": "x", "client_request_id": "x"}, format="json"
            ).status_code,
            404,
        )
        run = AiRun.objects.get()
        self.assertEqual(
            self.client.post(
                f"/api/v1/ai/conversations/{self.conversation.id}/runs/{run.id}/stop/"
            ).status_code,
            404,
        )

    def test_queued_stop_prevents_provider_call(self):
        self.submit()
        run = AiRun.objects.get()
        response = self.client.post(
            f"/api/v1/ai/conversations/{self.conversation.id}/runs/{run.id}/stop/"
        )
        self.assertEqual(response.status_code, 200)
        run.refresh_from_db()
        self.assertEqual(run.status, "stopped")
        with patch("apps.ai_assistant.worker.generate_answer") as generate:
            self.assertFalse(process_next_answer())
            generate.assert_not_called()

    @patch("apps.ai_assistant.worker.search")
    def test_answer_persists_without_client_connection(self, search):
        search.return_value = [
            {
                "document_id": "source",
                "filename": "rules.pdf",
                "location": {"page": 4},
                "excerpt": "Да",
            }
        ]
        self.submit()

        def fake_generate(
            _question, _history, _citations, _model, on_delta, _should_stop
        ):
            on_delta("Да, ")
            on_delta("можно [1].")
            return {
                "provider": "polza",
                "model": "test-model",
                "cost_rub": 0.25,
                "input_tokens": 10,
                "output_tokens": 4,
                "total_tokens": 14,
            }

        with patch(
            "apps.ai_assistant.worker.generate_answer", side_effect=fake_generate
        ):
            self.assertTrue(process_next_answer())
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        answer = response.data[-1]
        self.assertEqual(answer["content"], "Да, можно [1].")
        self.assertEqual(answer["run"]["status"], "completed")
        self.assertEqual(answer["run"]["found_chunks"], 1)
        self.assertEqual(answer["usage"]["cost_rub"], 0.25)
        self.assertEqual(answer["citations"][0]["location"]["page"], 4)

    @patch("apps.ai_assistant.worker.search", return_value=[])
    def test_no_evidence_does_not_invoke_paid_provider(self, _search):
        self.submit()
        with patch("apps.ai_assistant.worker.generate_answer") as generate:
            process_next_answer()
            generate.assert_not_called()
        self.assertIn(
            "не найдено подтверждения", self.client.get(self.url).data[-1]["content"]
        )

    def test_stale_generation_is_interrupted_without_paid_retry(self):
        self.submit()
        run = AiRun.objects.get()
        run.status = "generating"
        run.worker_id = "former-worker"
        run.heartbeat_at = timezone.now() - timedelta(minutes=2)
        run.save()
        AiMessage.objects.filter(pk=run.answer_id).update(content="Частичный ответ")
        self.assertEqual(recover_interrupted_runs(), 1)
        with patch("apps.ai_assistant.worker.generate_answer") as generate:
            self.assertFalse(process_next_answer())
            generate.assert_not_called()
        answer = self.client.get(self.url).data[-1]
        self.assertEqual(answer["run"]["status"], "interrupted")
        self.assertEqual(answer["content"], "Частичный ответ")
        _finish(run, "completed", "former-worker", usage={"cost_rub": 3.0})
        run.refresh_from_db()
        self.assertEqual(run.status, "interrupted")
        self.assertEqual(
            self.client.get(self.url).data[-1]["content"], "Частичный ответ"
        )


class LibraryTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username="user")
        self.manager = get_user_model().objects.create_user(username="Vova")
        self.document = AiDocument.objects.create(
            filename="rules.pdf", file="ai_assistant/rules.pdf"
        )
        self.client.force_authenticate(self.user)

    def test_public_document_payload_hides_file_path(self):
        response = self.client.get("/api/v1/ai/documents/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data[0]["classification"]["insurer"], None)
        self.assertNotIn("file", response.data[0])
        self.assertNotIn("path", response.data[0])

    def test_library_permissions_and_classification(self):
        self.assertEqual(
            self.client.delete(f"/api/v1/ai/documents/{self.document.id}/").status_code,
            403,
        )
        self.client.force_authenticate(self.manager)
        incomplete = self.client.patch(
            "/api/v1/ai/documents/classification/",
            {"document_ids": [str(self.document.id)], "insurer": "РЕСО"},
            format="json",
        )
        self.assertEqual(incomplete.status_code, 400)
        complete = self.client.patch(
            "/api/v1/ai/documents/classification/",
            {
                "document_ids": [str(self.document.id)],
                "insurer": "РЕСО",
                "insurance_kind": "КАСКО",
                "product": "Классика",
            },
            format="json",
        )
        self.assertEqual(complete.status_code, 200)
        self.assertEqual(complete.data[0]["classification"]["product"], "Классика")
        self.assertEqual(self.client.get("/api/v1/ai/catalog/").data["total"], 1)
