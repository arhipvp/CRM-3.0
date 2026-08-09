from unittest.mock import patch

from apps.common.tests.auth_utils import AuthenticatedAPITestCase
from apps.documents.external_jobs import process_next_external_job
from apps.documents.models import ExternalJob
from django.contrib.auth.models import User
from django.test import override_settings
from rest_framework import status


@override_settings(EXTERNAL_JOB_MAX_ATTEMPTS=1)
class ExternalJobApiTests(AuthenticatedAPITestCase):
    def setUp(self):
        super().setUp()
        self.user = User.objects.create_user(
            username="external-job-user", password="pass"  # pragma: allowlist secret
        )
        self.authenticate(self.user)

    @patch(
        "apps.documents.views.OpenNotebookSyncService.is_configured", return_value=True
    )
    def test_knowledge_ask_enqueues_job_by_default(self, _is_configured):
        response = self.api_client.post(
            "/api/v1/knowledge/ask/",
            {"notebook_id": "nb-1", "question": "Что покрывает полис?"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        job = ExternalJob.objects.get(pk=response.data["id"])
        self.assertEqual(job.kind, ExternalJob.Kind.OPEN_NOTEBOOK_ASK)
        self.assertEqual(job.created_by, self.user)
        self.assertEqual(job.payload["question"], "Что покрывает полис?")

    @patch("apps.documents.views.OpenNotebookSyncService.ask_notebook")
    @patch(
        "apps.documents.views.OpenNotebookSyncService.is_configured", return_value=True
    )
    def test_knowledge_ask_sync_flag_keeps_legacy_contract(
        self, _is_configured, ask_notebook
    ):
        ask_notebook.return_value = {"answer": "Ответ", "citations": []}

        response = self.api_client.post(
            "/api/v1/knowledge/ask/?sync=1",
            {"notebook_id": "nb-1", "question": "Вопрос"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["answer"], "Ответ")
        self.assertEqual(ExternalJob.objects.count(), 0)

    def test_worker_persists_result_and_status_endpoint_returns_it(self):
        job = ExternalJob.objects.create(
            kind=ExternalJob.Kind.OPEN_NOTEBOOK_ASK,
            payload={"notebook_id": "nb-1", "question": "Вопрос"},
            created_by=self.user,
        )
        with (
            patch(
                "apps.documents.external_jobs.OpenNotebookSyncService.is_configured",
                return_value=True,
            ),
            patch(
                "apps.documents.external_jobs.OpenNotebookSyncService.ask_notebook",
                return_value={"answer": "Ответ", "citations": []},
            ),
        ):
            self.assertTrue(process_next_external_job())

        response = self.api_client.get(f"/api/v1/external-jobs/{job.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], ExternalJob.Status.SUCCEEDED)
        self.assertEqual(response.data["result"]["answer"], "Ответ")

    def test_job_is_not_visible_to_another_user(self):
        job = ExternalJob.objects.create(
            kind=ExternalJob.Kind.OPEN_NOTEBOOK_ASK,
            payload={},
            created_by=self.user,
        )
        other = User.objects.create_user(
            username="other-job-user", password="pass"  # pragma: allowlist secret
        )
        self.authenticate(other)

        response = self.api_client.get(f"/api/v1/external-jobs/{job.id}/")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_superuser_can_view_another_users_job(self):
        job = ExternalJob.objects.create(
            kind=ExternalJob.Kind.OPEN_NOTEBOOK_ASK,
            payload={},
            created_by=self.user,
        )
        admin = User.objects.create_superuser(
            username="external-job-admin", password="pass"  # pragma: allowlist secret
        )
        self.authenticate(admin)

        response = self.api_client.get(f"/api/v1/external-jobs/{job.id}/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_worker_marks_permanent_failure(self):
        job = ExternalJob.objects.create(
            kind=ExternalJob.Kind.OPEN_NOTEBOOK_ASK,
            payload={"notebook_id": "nb-1", "question": "Вопрос"},
            created_by=self.user,
        )
        with patch(
            "apps.documents.external_jobs.OpenNotebookSyncService.is_configured",
            return_value=False,
        ):
            self.assertTrue(process_next_external_job())

        job.refresh_from_db()
        self.assertEqual(job.status, ExternalJob.Status.FAILED)
        self.assertIn("не настроен", job.error)
        self.assertIsNotNone(job.finished_at)

    @patch("apps.finances.services.exports.export_statement")
    def test_worker_exports_finance_statement(self, export_statement):
        export_statement.return_value = {
            "folder_id": "folder-1",
            "file": {"id": "file-1", "name": "statement.xlsx"},
        }
        job = ExternalJob.objects.create(
            kind=ExternalJob.Kind.FINANCE_STATEMENT_EXPORT,
            payload={"statement_id": "7b7ad40f-9301-4bb4-a049-6597fe226bcd"},
            created_by=self.user,
        )

        self.assertTrue(process_next_external_job())

        job.refresh_from_db()
        self.assertEqual(job.status, ExternalJob.Status.SUCCEEDED)
        self.assertEqual(job.result["folder_id"], "folder-1")
        export_statement.assert_called_once_with(
            user=self.user, statement_id=job.payload["statement_id"]
        )

    @patch("apps.finances.services.exports.export_financial_records")
    def test_worker_exports_filtered_financial_records(self, export_records):
        export_records.return_value = {
            "folder_id": "folder-2",
            "file": {"id": "file-2", "name": "records.xlsx"},
        }
        filters = {"record_type": "income", "search": "Клиент"}
        job = ExternalJob.objects.create(
            kind=ExternalJob.Kind.FINANCIAL_RECORDS_EXPORT,
            payload={"filters": filters},
            created_by=self.user,
        )

        self.assertTrue(process_next_external_job())

        job.refresh_from_db()
        self.assertEqual(job.status, ExternalJob.Status.SUCCEEDED)
        self.assertEqual(job.result["file"]["id"], "file-2")
        export_records.assert_called_once_with(user=self.user, filters=filters)
