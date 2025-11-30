from apps.chat.models import ChatMessage
from apps.clients.models import Client
from apps.deals.models import (
    Deal,
    InsuranceCompany,
    InsuranceType,
    Quote,
)
from apps.deals.services import DealMergeService
from apps.documents.models import Document
from apps.finances.models import Payment
from apps.notes.models import Note
from apps.policies.models import Policy
from apps.tasks.models import Task
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient, APITestCase
from rest_framework_simplejwt.tokens import RefreshToken


class DealMergeServiceTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="merge-user", password="pass")
        self.client_obj = Client.objects.create(name="Merge Client")
        self.target = Deal.objects.create(
            title="Target Deal",
            client=self.client_obj,
            seller=self.user,
            status="open",
            stage_name="initial",
        )
        self.source = Deal.objects.create(
            title="Source Deal",
            client=self.client_obj,
            seller=self.user,
            status="open",
            stage_name="initial",
        )

        Task.objects.create(title="Task", deal=self.source)
        Note.objects.create(body="Note", deal=self.source)
        Policy.objects.create(
            number="P-123",
            insurance_company=InsuranceCompany.objects.create(name="Acme"),
            insurance_type=InsuranceType.objects.create(name="Auto"),
            deal=self.source,
        )
        Payment.objects.create(amount=100, deal=self.source)
        ChatMessage.objects.create(body="Chat", deal=self.source)
        Quote.objects.create(
            deal=self.source,
            insurance_company=InsuranceCompany.objects.first(),
            insurance_type=InsuranceType.objects.first(),
            sum_insured=1000,
            premium=50,
        )
        Document.objects.create(
            title="Doc",
            file=SimpleUploadedFile("test.txt", b"content"),
            deal=self.source,
        )

    def test_service_moves_related_records(self):
        result = DealMergeService(
            target_deal=self.target,
            source_deals=[self.source],
            resulting_client=self.client_obj,
            actor=self.user,
        ).merge()

        self.assertEqual(Task.objects.filter(deal=self.target).count(), 1)
        self.assertEqual(Payment.objects.filter(deal=self.target).count(), 1)
        self.assertEqual(ChatMessage.objects.filter(deal=self.target).count(), 1)
        self.assertEqual(Note.objects.filter(deal=self.target).count(), 1)
        self.assertEqual(Policy.objects.filter(deal=self.target).count(), 1)
        self.assertEqual(Quote.objects.filter(deal=self.target).count(), 1)
        self.assertEqual(Document.objects.filter(deal=self.target).count(), 1)
        self.assertTrue(Deal.objects.with_deleted().get(pk=self.source.pk).is_deleted())
        self.assertEqual(result["merged_deal_ids"], [str(self.source.id)])
        self.assertEqual(
            result["moved_counts"],
            {
                "tasks": 1,
                "notes": 1,
                "documents": 1,
                "policies": 1,
                "payments": 1,
                "quotes": 1,
                "chat_messages": 1,
            },
        )


class DealMergeAPITestCase(APITestCase):
    def setUp(self):
        self.seller = User.objects.create_user(username="seller", password="pass")
        self.other_user = User.objects.create_user(username="other", password="pass")
        self.client_obj = Client.objects.create(name="Client")
        self.target = Deal.objects.create(
            title="Target",
            client=self.client_obj,
            seller=self.seller,
            status="open",
            stage_name="initial",
        )
        self.source = Deal.objects.create(
            title="Source A",
            client=self.client_obj,
            seller=self.seller,
            status="open",
            stage_name="initial",
        )
        self.source_extra = Deal.objects.create(
            title="Source B",
            client=self.client_obj,
            seller=self.seller,
            status="open",
            stage_name="initial",
        )
        Task.objects.create(title="Task", deal=self.source)
        Payment.objects.create(amount=100, deal=self.source)

        self.api_client = APIClient()
        self.seller_token = str(RefreshToken.for_user(self.seller).access_token)
        self.other_token = str(RefreshToken.for_user(self.other_user).access_token)

    def _payload(self, sources, resulting_client_id=None):
        payload = {
            "target_deal_id": str(self.target.id),
            "source_deal_ids": [str(deal.id) for deal in sources],
        }
        if resulting_client_id:
            payload["resulting_client_id"] = resulting_client_id
        return payload

    def test_merge_success(self):
        self.api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.seller_token}")
        response = self.api_client.post(
            "/api/v1/deals/merge/",
            self._payload([self.source, self.source_extra]),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["target_deal"]["id"], str(self.target.id))
        self.assertEqual(len(response.data["merged_deal_ids"]), 2)
        self.assertEqual(Task.objects.filter(deal=self.target).count(), 1)
        self.assertEqual(Payment.objects.filter(deal=self.target).count(), 1)
        self.assertFalse(Deal.objects.filter(id=self.source.id).exists())
        self.assertFalse(Deal.objects.filter(id=self.source_extra.id).exists())

    def test_merge_allows_specifying_client(self):
        other_client = Client.objects.create(name="Other")
        other_source = Deal.objects.create(
            title="Foreign",
            client=other_client,
            seller=self.seller,
            status="open",
            stage_name="initial",
        )
        self.api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.seller_token}")
        response = self.api_client.post(
            "/api/v1/deals/merge/",
            self._payload([self.source, other_source], resulting_client_id=str(other_client.id)),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["target_deal"]["clientId"], str(other_client.id))

    def test_merge_requires_owner(self):
        self.api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.other_token}")
        response = self.api_client.post(
            "/api/v1/deals/merge/",
            self._payload([self.source, self.source_extra]),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
