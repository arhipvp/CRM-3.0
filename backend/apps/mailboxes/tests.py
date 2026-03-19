from apps.clients.models import Client
from apps.common.tests.auth_utils import AuthenticatedAPITestCase
from apps.deals.models import Deal
from django.contrib.auth.models import User
from django.test import SimpleTestCase

from .models import Mailbox
from .serializers import MailboxSerializer
from .services import extract_quota_left


class ExtractQuotaLeftTests(SimpleTestCase):
    def test_extracts_quota_from_left_exceeded_error(self):
        self.assertEqual(
            extract_quota_left("mailbox_quota_left_exceeded (quota left: 128)"),
            128,
        )

    def test_extracts_quota_from_quota_exceeded_error(self):
        self.assertEqual(extract_quota_left("mailbox_quota_exceeded, 20"), 20)

    def test_returns_none_for_unrelated_error(self):
        self.assertIsNone(extract_quota_left("some_other_error"))

    def test_returns_none_when_value_is_not_positive(self):
        self.assertIsNone(extract_quota_left("mailbox_quota_exceeded, 0"))


class MailboxSerializerTests(SimpleTestCase):
    def test_serializes_null_deal_id_without_assertion(self):
        user = User(username="mailbox_user")
        mailbox = Mailbox(
            user=user,
            email="user@example.com",
            local_part="user",
            domain="example.com",
            display_name="User mailbox",
        )

        data = MailboxSerializer(mailbox).data

        self.assertIsNone(data["deal_id"])
        self.assertEqual(data["email"], "user@example.com")

    def test_serializes_related_deal_id(self):
        user = User(username="mailbox_user")
        deal = Deal(id="11111111-1111-1111-1111-111111111111")
        mailbox = Mailbox(
            user=user,
            deal=deal,
            email="deal@example.com",
            local_part="deal",
            domain="example.com",
        )

        data = MailboxSerializer(mailbox).data

        self.assertEqual(data["deal_id"], "11111111-1111-1111-1111-111111111111")


class MailboxListAPITests(AuthenticatedAPITestCase):
    def setUp(self):
        super().setUp()
        self.user = User.objects.create_user(
            username="mailbox_owner",
            password="pass",  # pragma: allowlist secret
        )
        self.other_user = User.objects.create_user(
            username="mailbox_other",
            password="pass",  # pragma: allowlist secret
        )
        self.client_record = Client.objects.create(name="Тестовый клиент")
        self.deal = Deal.objects.create(
            title="Сделка с почтой",
            client=self.client_record,
            seller=self.user,
            status="open",
        )
        Mailbox.objects.create(
            user=self.user,
            deal=self.deal,
            email="owned@example.com",
            local_part="owned",
            domain="example.com",
            display_name="Owned mailbox",
        )
        Mailbox.objects.create(
            user=self.other_user,
            email="other@example.com",
            local_part="other",
            domain="example.com",
            display_name="Other mailbox",
        )

    def test_list_returns_only_authenticated_user_mailboxes(self):
        self.authenticate(self.user)

        response = self.api_client.get("/api/v1/mailboxes/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["results"]), 1)
        self.assertEqual(response.data["results"][0]["email"], "owned@example.com")
        self.assertEqual(response.data["results"][0]["deal_id"], str(self.deal.id))
