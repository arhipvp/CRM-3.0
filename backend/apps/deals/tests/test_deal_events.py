from datetime import date

from apps.clients.models import Client
from apps.common.tests.auth_utils import AuthenticatedAPITestCase
from apps.deals.models import Deal, DealEvent, InsuranceCompany, InsuranceType
from apps.finances.models import Payment
from apps.policies.models import Policy
from django.contrib.auth.models import User
from rest_framework import status


class DealEventsAPITests(AuthenticatedAPITestCase):
    def setUp(self):
        super().setUp()
        self.user = User.objects.create_user(
            username="seller", password="pass"  # pragma: allowlist secret
        )
        self.client_record = Client.objects.create(name="Events Client")
        self.deal = Deal.objects.create(
            title="Events Deal",
            client=self.client_record,
            seller=self.user,
            status=Deal.DealStatus.OPEN,
        )
        self.company = InsuranceCompany.objects.create(name="Events Insurance")
        self.insurance_type = InsuranceType.objects.create(name="КАСКО")
        self.authenticate(self.user)

    def test_patch_expected_close_creates_manual_event(self):
        response = self.api_client.patch(
            f"/api/v1/deals/{self.deal.id}/",
            {"expected_close": "2026-07-01"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        event = DealEvent.objects.get(
            deal=self.deal,
            event_type=DealEvent.EventType.MANUAL_EXPECTED_CLOSE,
        )
        self.assertEqual(event.event_date, date(2026, 7, 1))
        self.assertEqual(event.actor, self.user)
        self.assertEqual(event.metadata["new_value"], "2026-07-01")

    def test_events_endpoint_returns_manual_payment_and_policy_events(self):
        DealEvent.objects.create(
            deal=self.deal,
            event_type=DealEvent.EventType.MANUAL_EXPECTED_CLOSE,
            event_date=date(2026, 7, 1),
            title="Дата «Застраховать до» выставлена вручную",
            source_type="deal",
            source_id=str(self.deal.id),
            actor=self.user,
        )
        policy = Policy.objects.create(
            number="POL-777",
            deal=self.deal,
            client=self.client_record,
            insurance_company=self.company,
            insurance_type=self.insurance_type,
            end_date=date(2026, 8, 15),
        )
        Payment.objects.create(
            deal=self.deal,
            policy=policy,
            amount=12500,
            description="Второй взнос",
            scheduled_date=date(2026, 7, 10),
        )

        response = self.api_client.get(f"/api/v1/deals/{self.deal.id}/events/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        event_types = {event["event_type"] for event in response.data}
        self.assertIn(DealEvent.EventType.MANUAL_EXPECTED_CLOSE, event_types)
        self.assertIn(DealEvent.EventType.PAYMENT_DUE, event_types)
        self.assertIn(DealEvent.EventType.POLICY_EXPIRATION, event_types)
        policy_event = next(
            event
            for event in response.data
            if event["event_type"] == DealEvent.EventType.POLICY_EXPIRATION
        )
        self.assertEqual(policy_event["metadata"]["policy_number"], "POL-777")
