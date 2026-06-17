from datetime import date

from apps.clients.models import Client
from apps.common.tests.auth_utils import AuthenticatedAPITestCase
from apps.deals.models import Deal, DealEvent, InsuranceCompany, InsuranceType
from apps.finances.models import Payment
from apps.policies.models import Policy
from apps.users.models import AuditLog
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

    def test_events_endpoint_does_not_return_audit_log_entries(self):
        AuditLog.objects.create(
            actor=self.user,
            object_type="deal",
            object_id=str(self.deal.id),
            action="update",
            object_name=self.deal.title,
            description="Техническое изменение сделки",
        )

        response = self.api_client.get(f"/api/v1/deals/{self.deal.id}/events/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotIn("audit", {event["source_type"] for event in response.data})
        self.assertNotIn(
            DealEvent.EventType.DEAL_UPDATED,
            {event["event_type"] for event in response.data},
        )

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

    def test_create_update_and_delete_manual_event(self):
        create_response = self.api_client.post(
            f"/api/v1/deals/{self.deal.id}/events/",
            {
                "event_date": "2027-06-16",
                "reason": "Предположительно купит квартиру, предложить застраховать",
            },
            format="json",
        )

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(create_response.data["event_type"], DealEvent.EventType.MANUAL)
        self.assertEqual(create_response.data["event_date"], "2027-06-16")
        self.assertEqual(
            create_response.data["title"],
            "Предположительно купит квартиру, предложить застраховать",
        )
        self.assertEqual(create_response.data["source_type"], "")
        self.assertEqual(create_response.data["source_id"], "")
        event = DealEvent.objects.get(event_type=DealEvent.EventType.MANUAL)
        self.assertEqual(event.actor, self.user)

        update_response = self.api_client.patch(
            f"/api/v1/deals/{self.deal.id}/events/{create_response.data['id']}/",
            {
                "event_date": "2027-06-17",
                "reason": "Клиент выбрал квартиру, вернуться с предложением",
            },
            format="json",
        )

        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        self.assertEqual(update_response.data["event_date"], "2027-06-17")
        self.assertEqual(
            update_response.data["title"],
            "Клиент выбрал квартиру, вернуться с предложением",
        )

        delete_response = self.api_client.delete(
            f"/api/v1/deals/{self.deal.id}/events/{create_response.data['id']}/"
        )

        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(DealEvent.objects.filter(id=event.id).exists())

    def test_update_and_delete_manual_date_event(self):
        event = DealEvent.objects.create(
            deal=self.deal,
            event_type=DealEvent.EventType.MANUAL_EXPECTED_CLOSE,
            event_date=date(2026, 7, 1),
            title="Дата «Застраховать до» выставлена вручную",
            source_type="deal",
            source_id=str(self.deal.id),
            actor=self.user,
        )

        update_response = self.api_client.patch(
            f"/api/v1/deals/{self.deal.id}/events/{event.id}/",
            {
                "event_date": "2026-07-02",
                "reason": "Причина даты уточнена вручную",
            },
            format="json",
        )

        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        self.assertEqual(update_response.data["event_date"], "2026-07-02")
        self.assertEqual(update_response.data["title"], "Причина даты уточнена вручную")

        delete_response = self.api_client.delete(
            f"/api/v1/deals/{self.deal.id}/events/{event.id}/"
        )

        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(DealEvent.objects.filter(id=event.id).exists())

    def test_cannot_update_or_delete_policy_event(self):
        event = DealEvent.objects.create(
            deal=self.deal,
            event_type=DealEvent.EventType.POLICY_CREATED,
            event_date=date(2026, 7, 1),
            title="Полис создан",
            source_type="policy",
            source_id="policy-1",
            actor=self.user,
        )

        update_response = self.api_client.patch(
            f"/api/v1/deals/{self.deal.id}/events/{event.id}/",
            {"reason": "Нельзя менять системное событие"},
            format="json",
        )
        delete_response = self.api_client.delete(
            f"/api/v1/deals/{self.deal.id}/events/{event.id}/"
        )

        self.assertEqual(update_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(delete_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(DealEvent.objects.filter(id=event.id).exists())

    def test_visible_user_cannot_create_manual_event(self):
        viewer = User.objects.create_user(
            username="viewer", password="pass"  # pragma: allowlist secret
        )
        self.deal.visible_users.add(viewer)
        self.authenticate(viewer)

        response = self.api_client.post(
            f"/api/v1/deals/{self.deal.id}/events/",
            {
                "event_date": "2027-06-16",
                "reason": "Причина от наблюдателя",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(
            DealEvent.objects.filter(event_type=DealEvent.EventType.MANUAL).exists()
        )
