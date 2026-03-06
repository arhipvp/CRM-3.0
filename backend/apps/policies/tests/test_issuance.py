from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from apps.clients.models import Client
from apps.common.tests.auth_utils import AuthenticatedAPITestCase
from apps.deals.models import Deal, InsuranceCompany, InsuranceType, Quote
from apps.policies.issuance import (
    _sync_execution_from_result,
    build_policy_issuance_payload,
    cancel_policy_issuance,
    get_execution_paths,
    resume_policy_issuance,
    start_policy_issuance,
)
from apps.policies.models import Policy, PolicyIssuanceExecution
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.test import TestCase, override_settings
from django.utils import timezone


class PolicyIssuanceServiceTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="seller", password="pass")
        self.client_obj = Client.objects.create(name="Иван Иванов")
        self.deal = Deal.objects.create(
            title="Deal",
            client=self.client_obj,
            seller=self.user,
            status="open",
            stage_name="initial",
        )
        self.company = InsuranceCompany.objects.create(name="Сбер Страхование")
        self.insurance_type = InsuranceType.objects.create(name="ОСАГО")
        Quote.objects.create(
            deal=self.deal,
            seller=self.user,
            insurance_company=self.company,
            insurance_type=self.insurance_type,
            sum_insured="1000000.00",
            premium="15000.00",
        )
        self.policy = Policy.objects.create(
            number="TEMP-001",
            deal=self.deal,
            client=self.client_obj,
            insurance_company=self.company,
            insurance_type=self.insurance_type,
            is_vehicle=True,
            brand="BMW",
            model="X5",
            vin="WBA12345678901234",
            start_date="2026-03-10",
            end_date="2027-03-09",
        )

    def test_build_payload_requires_required_fields(self):
        self.policy.vin = ""
        self.policy.save(update_fields=["vin", "updated_at"])

        with self.assertRaises(ValidationError) as error:
            build_policy_issuance_payload(self.policy)

        self.assertIn("missing_fields", error.exception.message_dict)

    @patch("apps.policies.issuance._start_runner")
    def test_start_forbids_second_active_execution(self, start_runner_mock):
        first = start_policy_issuance(self.policy, self.user)
        self.assertEqual(first.status, PolicyIssuanceExecution.Status.QUEUED)
        with self.assertRaises(ValidationError):
            start_policy_issuance(self.policy, self.user)
        start_runner_mock.assert_called_once()

    def test_resume_requires_waiting_manual(self):
        execution = PolicyIssuanceExecution.objects.create(
            policy=self.policy,
            requested_by=self.user,
            status=PolicyIssuanceExecution.Status.RUNNING,
            resume_token="token",
        )

        with self.assertRaises(ValidationError):
            resume_policy_issuance(execution)

    def test_cancel_marks_execution_canceled(self):
        execution = PolicyIssuanceExecution.objects.create(
            policy=self.policy,
            requested_by=self.user,
            status=PolicyIssuanceExecution.Status.WAITING_MANUAL,
            resume_token="token",
        )

        with TemporaryDirectory() as temp_dir:
            with override_settings(SBER_ISSUANCE_WORKDIR=temp_dir):
                canceled = cancel_policy_issuance(execution)

        canceled.refresh_from_db()
        self.assertEqual(canceled.status, PolicyIssuanceExecution.Status.CANCELED)
        self.assertIsNotNone(canceled.finished_at)

    def test_sync_result_writes_policy_number_on_success(self):
        execution = PolicyIssuanceExecution.objects.create(
            policy=self.policy,
            requested_by=self.user,
            status=PolicyIssuanceExecution.Status.RUNNING,
            resume_token="token",
            started_at=timezone.now(),
        )

        with TemporaryDirectory() as temp_dir:
            with override_settings(SBER_ISSUANCE_WORKDIR=temp_dir):
                paths = get_execution_paths(str(execution.id))
                paths.result_file.write_text(
                    """
                    {
                      "status": "succeeded",
                      "step": "completed",
                      "external_policy_number": "OSAGO-12345",
                      "log": [],
                      "started_at": "2026-03-06T10:00:00Z",
                      "finished_at": "2026-03-06T10:05:00Z"
                    }
                    """.strip(),
                    encoding="utf-8",
                )
                _sync_execution_from_result(str(execution.id), paths)

        execution.refresh_from_db()
        self.policy.refresh_from_db()
        self.assertEqual(execution.status, PolicyIssuanceExecution.Status.SUCCEEDED)
        self.assertEqual(self.policy.number, "OSAGO-12345")


class PolicyIssuanceAPITests(AuthenticatedAPITestCase):
    def setUp(self):
        super().setUp()
        self.seller = User.objects.create_user(username="seller", password="pass")
        self.other = User.objects.create_user(username="other", password="pass")
        self.client_obj = Client.objects.create(name="Иван Иванов")
        self.deal = Deal.objects.create(
            title="Deal",
            client=self.client_obj,
            seller=self.seller,
            status="open",
            stage_name="initial",
        )
        self.company = InsuranceCompany.objects.create(name="Сбер Страхование")
        self.insurance_type = InsuranceType.objects.create(name="ОСАГО")
        self.policy = Policy.objects.create(
            number="TEMP-002",
            deal=self.deal,
            client=self.client_obj,
            insurance_company=self.company,
            insurance_type=self.insurance_type,
            is_vehicle=True,
            brand="BMW",
            model="X5",
            vin="WBA12345678901234",
            start_date="2026-03-10",
            end_date="2027-03-09",
        )
        self.authenticate(self.seller)

    def _create_execution(self, status=PolicyIssuanceExecution.Status.WAITING_MANUAL):
        return PolicyIssuanceExecution.objects.create(
            policy=self.policy,
            requested_by=self.seller,
            status=status,
            step="manual_login",
            manual_step_reason="Нужен SMS-код.",
            resume_token="token",
            log=[],
        )

    @patch("apps.policies.views.start_policy_issuance")
    def test_start_endpoint_returns_execution(self, start_mock):
        execution = self._create_execution(status=PolicyIssuanceExecution.Status.QUEUED)
        start_mock.return_value = execution

        response = self.api_client.post(
            f"/api/v1/policies/{self.policy.id}/sber-issuance/start/", {}, format="json"
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["status"], PolicyIssuanceExecution.Status.QUEUED)

    def test_start_endpoint_rejects_user_without_access(self):
        self.authenticate(self.other)

        response = self.api_client.post(
            f"/api/v1/policies/{self.policy.id}/sber-issuance/start/", {}, format="json"
        )

        self.assertEqual(response.status_code, 403)

    def test_status_endpoint_returns_404_without_execution(self):
        response = self.api_client.get(f"/api/v1/policies/{self.policy.id}/sber-issuance/")
        self.assertEqual(response.status_code, 404)

    @patch("apps.policies.views.resume_policy_issuance")
    def test_resume_endpoint_uses_latest_execution(self, resume_mock):
        execution = self._create_execution()
        resume_mock.return_value = execution

        response = self.api_client.post(
            f"/api/v1/policies/{self.policy.id}/sber-issuance/resume/", {}, format="json"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], PolicyIssuanceExecution.Status.WAITING_MANUAL)
        resume_mock.assert_called_once()

    @patch("apps.policies.views.cancel_policy_issuance")
    def test_cancel_endpoint_returns_status(self, cancel_mock):
        execution = self._create_execution()
        execution.status = PolicyIssuanceExecution.Status.CANCELED
        cancel_mock.return_value = execution

        response = self.api_client.post(
            f"/api/v1/policies/{self.policy.id}/sber-issuance/cancel/", {}, format="json"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], PolicyIssuanceExecution.Status.CANCELED)
