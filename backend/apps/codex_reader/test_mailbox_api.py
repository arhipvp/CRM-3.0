from concurrent.futures import ThreadPoolExecutor
from threading import Event
from unittest import skipUnless
from unittest.mock import patch

from apps.clients.models import Client
from apps.deals.models import Deal
from apps.mailboxes.mailcow_client import MailcowError
from apps.mailboxes.models import Mailbox
from django.contrib.auth import get_user_model
from django.db import IntegrityError, connection, connections
from django.test import override_settings
from rest_framework.test import APIClient, APITestCase, APITransactionTestCase

from .models import CodexReadKey, CodexWriteKey


@override_settings(MAILCOW_DOMAIN="example.test", MAILCOW_MAILBOX_QUOTA_MB=3072)
class CodexMailboxApiTests(APITestCase):
    def setUp(self):
        for target in (
            "apps.clients.signals.ensure_client_folder",
            "apps.deals.signals.ensure_deal_folder",
        ):
            mocked = patch(target, return_value=None)
            mocked.start()
            self.addCleanup(mocked.stop)
        self.seller = get_user_model().objects.create_user(username="mail_seller")
        self.executor = get_user_model().objects.create_user(username="mail_executor")
        self.customer = Client.objects.create(name="Тест Клиент")
        self.deal = Deal.objects.create(
            title="ОСАГО",
            client=self.customer,
            seller=self.seller,
            executor=self.executor,
        )
        self.read_key, self.read_token = CodexReadKey.issue("mailbox read")
        self.write_key, self.write_token = CodexWriteKey.issue("mailbox write")
        self.read_url = f"/api/v1/codex/deals/{self.deal.id}/mailbox/address/"
        self.write_url = f"/api/v1/codex/write/deals/{self.deal.id}/mailbox/ensure/"

    def authorize(self, token):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    def test_read_address_without_imap_and_existing_mailbox(self):
        self.authorize(self.read_token)
        with patch("imaplib.IMAP4_SSL") as imap:
            empty = self.client.get(self.read_url)
            self.assertEqual(empty.status_code, 200)
            self.assertEqual(empty.data["email"], None)
            mailbox = Mailbox.objects.create(
                user=self.seller,
                deal=self.deal,
                email="deal@example.test",
                local_part="deal",
                domain="example.test",
            )
            found = self.client.get(self.read_url)
            self.assertEqual(found.status_code, 200)
            self.assertEqual(found.data["email"], mailbox.email)
            self.assertFalse(found.data["created"])
            imap.assert_not_called()

    @patch("apps.codex_reader.mailbox_views.MailcowClient")
    def test_ensure_creates_once_and_never_returns_password(self, mailcow_class):
        self.authorize(self.write_token)
        first = self.client.post(self.write_url, {}, format="json")
        second = self.client.post(self.write_url, {}, format="json")
        self.assertEqual((first.status_code, second.status_code), (201, 200))
        self.assertEqual(first.data["email"], second.data["email"])
        self.assertEqual(first.data["deal_id"], str(self.deal.id))
        self.assertTrue(first.data["created"])
        self.assertFalse(second.data["created"])
        self.assertEqual(Mailbox.objects.filter(deal=self.deal).count(), 1)
        self.assertEqual(Mailbox.objects.get(deal=self.deal).user, self.seller)
        mailcow_class.return_value.create_mailbox.assert_called_once()
        self.assertNotIn("password", str(first.data).lower())

    @patch("apps.codex_reader.mailbox_views.MailcowClient")
    def test_executor_owns_mailbox_when_seller_absent(self, unused_client):
        self.deal.seller = None
        self.deal.save(update_fields=["seller"])
        self.authorize(self.write_token)
        response = self.client.post(self.write_url, {}, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Mailbox.objects.get(deal=self.deal).user, self.executor)

    @patch("apps.codex_reader.mailbox_views.MailcowClient")
    def test_missing_owner_and_mailcow_failure(self, mailcow_class):
        self.deal.seller = None
        self.deal.executor = None
        self.deal.save(update_fields=["seller", "executor"])
        self.authorize(self.write_token)
        self.assertEqual(self.client.post(self.write_url, {}).status_code, 409)
        mailcow_class.assert_not_called()
        self.deal.seller = self.seller
        self.deal.save(update_fields=["seller"])
        mailcow_class.return_value.create_mailbox.side_effect = MailcowError(
            "upstream password=private"
        )
        failed = self.client.post(self.write_url, {})
        self.assertEqual(failed.status_code, 502)
        self.assertNotIn("private", str(failed.data))
        self.assertFalse(Mailbox.objects.filter(deal=self.deal).exists())

    @patch("apps.codex_reader.mailbox_views.MailcowClient")
    @patch("apps.codex_reader.mailbox_views.Mailbox.objects.create")
    def test_db_failure_compensates_mailcow(self, create_mailbox, mailcow_class):
        create_mailbox.side_effect = IntegrityError("duplicate address")
        self.authorize(self.write_token)
        response = self.client.post(self.write_url, {})
        self.assertEqual(response.status_code, 409)
        mailcow_class.return_value.delete_mailbox.assert_called_once()

    @patch("apps.codex_reader.mailbox_views.MailcowClient")
    def test_keys_revocation_deleted_deal_and_methods(self, mailcow_class):
        self.authorize(self.read_token)
        self.assertEqual(self.client.post(self.write_url, {}).status_code, 403)
        self.assertEqual(self.client.post(self.read_url, {}).status_code, 405)
        self.authorize(self.write_token)
        self.assertEqual(self.client.get(self.read_url).status_code, 403)
        self.assertEqual(self.client.get(self.write_url).status_code, 405)
        self.write_key.revoke()
        self.assertEqual(self.client.post(self.write_url, {}).status_code, 403)
        self.authorize(self.read_token)
        self.read_key.revoke()
        self.assertEqual(self.client.get(self.read_url).status_code, 403)
        _, fresh_write = CodexWriteKey.issue("fresh mailbox writer")
        _, fresh_read = CodexReadKey.issue("fresh mailbox reader")
        self.deal.delete()
        self.authorize(fresh_write)
        self.assertEqual(self.client.post(self.write_url, {}).status_code, 404)
        self.authorize(fresh_read)
        self.assertEqual(self.client.get(self.read_url).status_code, 404)
        mailcow_class.assert_not_called()


@skipUnless(connection.vendor == "postgresql", "Row locking requires PostgreSQL")
@override_settings(MAILCOW_DOMAIN="example.test")
class CodexMailboxConcurrencyTests(APITransactionTestCase):
    def test_concurrent_ensure_creates_one_mailbox(self):
        for target in (
            "apps.clients.signals.ensure_client_folder",
            "apps.deals.signals.ensure_deal_folder",
        ):
            mocked = patch(target, return_value=None)
            mocked.start()
            self.addCleanup(mocked.stop)
        seller = get_user_model().objects.create_user(username="concurrent_seller")
        customer = Client.objects.create(name="Тест Клиент")
        deal = Deal.objects.create(title="ОСАГО", client=customer, seller=seller)
        _, token = CodexWriteKey.issue("concurrent writer")
        url = f"/api/v1/codex/write/deals/{deal.id}/mailbox/ensure/"
        first_entered = Event()
        release_first = Event()
        second_started = Event()

        def create_mailbox(*args, **kwargs):
            first_entered.set()
            self.assertTrue(release_first.wait(10))

        def ensure(second_request=False):
            try:
                client = APIClient()
                client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
                if second_request:
                    second_started.set()
                return client.post(url, {}, format="json")
            finally:
                connections.close_all()

        with patch("apps.codex_reader.mailbox_views.MailcowClient") as mailcow_class:
            mailcow_class.return_value.create_mailbox.side_effect = create_mailbox
            with ThreadPoolExecutor(max_workers=2) as executor:
                first = executor.submit(ensure)
                self.assertTrue(first_entered.wait(10))
                second = executor.submit(ensure, True)
                self.assertTrue(second_started.wait(10))
                release_first.set()
                responses = (first.result(timeout=15), second.result(timeout=15))

        self.assertEqual(
            sorted(response.status_code for response in responses), [200, 201]
        )
        self.assertEqual(responses[0].data["email"], responses[1].data["email"])
        self.assertEqual(Mailbox.objects.filter(deal=deal).count(), 1)
        mailcow_class.return_value.create_mailbox.assert_called_once()
