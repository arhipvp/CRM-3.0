from datetime import timedelta
from unittest.mock import patch

from apps.clients.models import Client
from apps.deals.models import Deal, InsuranceCompany, InsuranceType
from apps.notifications.telegram_notifications import send_policy_expiry_reminders
from apps.policies.models import Policy
from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone


class PolicyExpiryReminderTests(TestCase):
    def setUp(self):
        self.seller = User.objects.create_user(username="seller-reminder")
        self.client_obj = Client.objects.create(name="Reminder client")
        self.deal = Deal.objects.create(
            title="Reminder deal",
            client=self.client_obj,
            seller=self.seller,
            status="open",
            stage_name="initial",
        )
        self.company = InsuranceCompany.objects.create(name="Reminder company")
        self.insurance_type = InsuranceType.objects.create(name="Reminder type")

    def test_send_policy_expiry_reminders_skips_renewed_policies(self):
        today = timezone.localdate()
        renewed_policy = Policy.objects.create(
            number="POL-OLD",
            deal=self.deal,
            insurance_company=self.company,
            insurance_type=self.insurance_type,
            client=self.client_obj,
            end_date=today + timedelta(days=3),
        )
        successor_policy = Policy.objects.create(
            number="POL-NEW",
            deal=self.deal,
            insurance_company=self.company,
            insurance_type=self.insurance_type,
            client=self.client_obj,
            end_date=today + timedelta(days=365),
        )
        renewed_policy.renewed_by = successor_policy
        renewed_policy.save(update_fields=["renewed_by", "updated_at"])

        with patch(
            "apps.notifications.telegram_notifications.send_notification"
        ) as send_notification_mock:
            send_policy_expiry_reminders()

        send_notification_mock.assert_not_called()
