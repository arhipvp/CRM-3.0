from datetime import datetime, timezone
from unittest.mock import patch

from apps.clients.models import Client
from apps.common.tests.auth_utils import AuthenticatedAPITestCase
from apps.deals.models import Deal, DealTimeTick
from django.contrib.auth.models import User
from django.test import override_settings
from rest_framework import status


@override_settings(
    DEAL_TIME_TRACKING_ENABLED=True,
    DEAL_TIME_TRACKING_TICK_SECONDS=10,
    DEAL_TIME_TRACKING_CONFIRM_INTERVAL_SECONDS=600,
)
class DealTimeTrackingTests(AuthenticatedAPITestCase):
    def setUp(self):
        super().setUp()
        self.seller = User.objects.create_user(username="seller", password="pass")
        self.executor = User.objects.create_user(username="executor", password="pass")
        self.other = User.objects.create_user(username="other", password="pass")
        self.client_obj = Client.objects.create(name="Client")
        self.deal = Deal.objects.create(
            title="Deal",
            client=self.client_obj,
            seller=self.seller,
            executor=self.executor,
            status=Deal.DealStatus.OPEN,
            stage_name="initial",
        )
        self.other_deal = Deal.objects.create(
            title="Other Deal",
            client=self.client_obj,
            seller=self.seller,
            executor=self.executor,
            status=Deal.DealStatus.OPEN,
            stage_name="initial",
        )
        self.authenticate(self.seller)

    def test_summary_returns_zero_when_no_ticks(self):
        response = self.api_client.get(
            f"/api/v1/deals/{self.deal.id}/time-track/summary/"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()
        self.assertTrue(payload["enabled"])
        self.assertEqual(payload["tick_seconds"], 10)
        self.assertEqual(payload["confirm_interval_seconds"], 600)
        self.assertEqual(payload["my_total_seconds"], 0)
        self.assertEqual(payload["my_total_human"], "00:00:00")

    def test_first_tick_counts_then_duplicate_does_not(self):
        fixed_now = datetime(2026, 2, 20, 12, 0, 5, tzinfo=timezone.utc)
        with patch("apps.deals.views.timezone.now", return_value=fixed_now):
            response_first = self.api_client.post(
                f"/api/v1/deals/{self.deal.id}/time-track/tick/",
                {},
                format="json",
            )
            response_second = self.api_client.post(
                f"/api/v1/deals/{self.deal.id}/time-track/tick/",
                {},
                format="json",
            )

        self.assertEqual(response_first.status_code, status.HTTP_200_OK)
        self.assertEqual(response_second.status_code, status.HTTP_200_OK)
        payload_first = response_first.json()
        payload_second = response_second.json()
        self.assertTrue(payload_first["counted"])
        self.assertFalse(payload_second["counted"])
        self.assertEqual(payload_second["reason"], "duplicate")
        self.assertEqual(payload_second["my_total_seconds"], 10)
        self.assertEqual(
            DealTimeTick.objects.filter(user=self.seller, deal=self.deal).count(), 1
        )

    def test_tick_for_other_deal_in_same_bucket_is_blocked(self):
        fixed_now = datetime(2026, 2, 20, 12, 0, 8, tzinfo=timezone.utc)
        with patch("apps.deals.views.timezone.now", return_value=fixed_now):
            response_first = self.api_client.post(
                f"/api/v1/deals/{self.deal.id}/time-track/tick/",
                {},
                format="json",
            )
            response_second = self.api_client.post(
                f"/api/v1/deals/{self.other_deal.id}/time-track/tick/",
                {},
                format="json",
            )

        self.assertEqual(response_first.status_code, status.HTTP_200_OK)
        self.assertEqual(response_second.status_code, status.HTTP_200_OK)
        self.assertTrue(response_first.json()["counted"])
        payload_second = response_second.json()
        self.assertFalse(payload_second["counted"])
        self.assertEqual(payload_second["reason"], "bucket_taken_by_other_deal")
        self.assertEqual(payload_second["my_total_seconds"], 0)

    def test_next_bucket_counts(self):
        first_now = datetime(2026, 2, 20, 12, 0, 1, tzinfo=timezone.utc)
        second_now = datetime(2026, 2, 20, 12, 0, 11, tzinfo=timezone.utc)
        with patch("apps.deals.views.timezone.now", return_value=first_now):
            self.api_client.post(
                f"/api/v1/deals/{self.deal.id}/time-track/tick/",
                {},
                format="json",
            )
        with patch("apps.deals.views.timezone.now", return_value=second_now):
            response = self.api_client.post(
                f"/api/v1/deals/{self.deal.id}/time-track/tick/",
                {},
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.json()["counted"])
        self.assertEqual(response.json()["my_total_seconds"], 20)

    def test_no_access_returns_404(self):
        self.authenticate(self.other)
        response = self.api_client.get(
            f"/api/v1/deals/{self.deal.id}/time-track/summary/"
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    @override_settings(DEAL_TIME_TRACKING_ENABLED=False)
    def test_disabled_tracking_returns_counted_false(self):
        response = self.api_client.post(
            f"/api/v1/deals/{self.deal.id}/time-track/tick/",
            {},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()
        self.assertFalse(payload["enabled"])
        self.assertFalse(payload["counted"])
        self.assertEqual(payload["reason"], "disabled")
