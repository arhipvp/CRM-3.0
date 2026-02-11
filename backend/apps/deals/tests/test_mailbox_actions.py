from unittest.mock import patch

from apps.clients.models import Client
from apps.common.tests.auth_utils import AuthenticatedAPITestCase
from apps.deals.models import Deal
from apps.mailboxes.models import Mailbox
from django.contrib.auth.models import User
from django.test import override_settings
from rest_framework import status


@override_settings(MAILCOW_DOMAIN="zoom78.com", MAILCOW_MAILBOX_QUOTA_MB=3072)
class DealMailboxActionsTests(AuthenticatedAPITestCase):
    def setUp(self):
        super().setUp()
        self.seller = User.objects.create_user(username="seller_mail", password="pass")
        self.executor = User.objects.create_user(
            username="executor_mail", password="pass"
        )
        self.viewer = User.objects.create_user(username="viewer_mail", password="pass")
        self.client_record = Client.objects.create(name="Тест Клиент")
        self.deal = Deal.objects.create(
            title="Сделка по почте",
            client=self.client_record,
            seller=self.seller,
            executor=self.executor,
            status="open",
        )
        self.deal.visible_users.add(self.viewer)

    @patch("apps.deals.views.MailcowClient")
    def test_seller_can_create_mailbox_for_deal(self, mailcow_client_cls):
        self.authenticate(self.seller)

        response = self.api_client.post(
            f"/api/v1/deals/{self.deal.id}/mailbox/create/",
            {},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.deal.refresh_from_db()
        mailbox = self.deal.mailbox
        self.assertIsNotNone(mailbox)
        self.assertTrue(mailbox.email.endswith("@" + mailbox.domain))
        self.assertIn("mailbox_initial_password", response.data)

        self.assertTrue(mailcow_client_cls.return_value.ensure_domain.called)
        self.assertTrue(mailcow_client_cls.return_value.create_mailbox.called)

    @patch("apps.deals.views.MailcowClient")
    def test_executor_can_create_mailbox_for_deal(self, _mailcow_client_cls):
        self.authenticate(self.executor)

        response = self.api_client.post(
            f"/api/v1/deals/{self.deal.id}/mailbox/create/",
            {},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.deal.refresh_from_db()
        self.assertIsNotNone(self.deal.mailbox)

    @patch("apps.deals.views.MailcowClient")
    def test_viewer_cannot_create_mailbox_for_deal(self, _mailcow_client_cls):
        self.authenticate(self.viewer)

        response = self.api_client.post(
            f"/api/v1/deals/{self.deal.id}/mailbox/create/",
            {},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(Mailbox.objects.filter(deal=self.deal).exists())

    @patch("apps.deals.views.MailcowClient")
    def test_create_mailbox_uses_suffix_when_base_taken(self, _mailcow_client_cls):
        Mailbox.objects.create(
            user=self.seller,
            email="test_klient@zoom78.com",
            local_part="test_klient",
            domain="zoom78.com",
            display_name="old",
        )
        self.authenticate(self.seller)

        with self.settings(MAILCOW_DOMAIN="zoom78.com"):
            response = self.api_client.post(
                f"/api/v1/deals/{self.deal.id}/mailbox/create/",
                {},
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.deal.refresh_from_db()
        self.assertEqual(self.deal.mailbox.local_part, "test_klient_1")

    @patch("apps.deals.views.process_mailbox_messages")
    def test_seller_can_check_mailbox(self, process_mailbox_messages):
        Mailbox.objects.create(
            user=self.seller,
            deal=self.deal,
            email="mailbox@zoom78.com",
            local_part="mailbox",
            domain="zoom78.com",
            display_name="mailbox",
        )
        process_mailbox_messages.return_value = {
            "processed": 2,
            "skipped": 1,
            "failed": 0,
            "deleted": 3,
        }

        self.authenticate(self.seller)
        response = self.api_client.post(
            f"/api/v1/deals/{self.deal.id}/mailbox/check/",
            {},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["mailbox_sync"]["processed"], 2)

    @patch("apps.deals.views.process_mailbox_messages")
    def test_viewer_cannot_check_mailbox(self, process_mailbox_messages):
        Mailbox.objects.create(
            user=self.seller,
            deal=self.deal,
            email="mailbox@zoom78.com",
            local_part="mailbox",
            domain="zoom78.com",
            display_name="mailbox",
        )

        self.authenticate(self.viewer)
        response = self.api_client.post(
            f"/api/v1/deals/{self.deal.id}/mailbox/check/",
            {},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        process_mailbox_messages.assert_not_called()
