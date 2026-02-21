import datetime

from apps.chat.models import ChatMessage
from apps.clients.models import Client
from apps.common.tests.auth_utils import AuthenticatedAPITestCase
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
from apps.users.models import AuditLog
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework import status


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
            final_deal_data={
                "title": "Merged Deal",
                "client_id": self.client_obj.id,
                "seller_id": self.user.id,
            },
            actor=self.user,
        ).merge()

        result_deal = result["result_deal"]
        self.assertEqual(Task.objects.filter(deal=result_deal).count(), 1)
        self.assertEqual(Payment.objects.filter(deal=result_deal).count(), 1)
        self.assertEqual(ChatMessage.objects.filter(deal=result_deal).count(), 1)
        self.assertEqual(Note.objects.filter(deal=result_deal).count(), 1)
        self.assertEqual(Policy.objects.filter(deal=result_deal).count(), 1)
        self.assertEqual(Quote.objects.filter(deal=result_deal).count(), 1)
        self.assertEqual(Document.objects.filter(deal=result_deal).count(), 1)
        self.assertTrue(Deal.objects.with_deleted().get(pk=self.target.pk).is_deleted())
        self.assertTrue(Deal.objects.with_deleted().get(pk=self.source.pk).is_deleted())
        self.assertEqual(
            result["merged_deal_ids"], [str(self.target.id), str(self.source.id)]
        )
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
                "deal_pins": 0,
                "deal_viewers": 0,
                "time_ticks": 0,
            },
        )

    def test_merge_does_not_change_policy_client_fields(self):
        external_client = Client.objects.create(name="External Policy Client")
        policy = Policy.objects.create(
            number="P-CLIENT-LOCK",
            insurance_company=InsuranceCompany.objects.create(name="Comp B"),
            insurance_type=InsuranceType.objects.create(name="Type B"),
            deal=self.source,
            client=external_client,
            insured_client=external_client,
        )

        result = DealMergeService(
            target_deal=self.target,
            source_deals=[self.source],
            final_deal_data={
                "title": "Merged Client Lock",
                "client_id": self.client_obj.id,
                "seller_id": self.user.id,
            },
            actor=self.user,
        ).merge()

        policy.refresh_from_db()
        self.assertEqual(policy.deal_id, result["result_deal"].id)
        self.assertEqual(policy.client_id, external_client.id)
        self.assertEqual(policy.insured_client_id, external_client.id)


class DealMergeAPITestCase(AuthenticatedAPITestCase):
    def setUp(self):
        super().setUp()
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

        self.token_for(self.seller)
        self.token_for(self.other_user)

    def _payload(self, sources, include_final_deal=True):
        payload = {
            "target_deal_id": str(self.target.id),
            "source_deal_ids": [str(deal.id) for deal in sources],
        }
        if include_final_deal:
            payload["final_deal"] = {
                "title": "Merged deal",
                "client_id": str(self.target.client_id),
                "seller_id": str(self.seller.id),
                "executor_id": None,
                "description": "",
                "source": "",
                "expected_close": None,
                "next_contact_date": None,
                "visible_user_ids": [],
            }
        return payload

    def test_merge_success(self):
        self.authenticate(self.seller)
        response = self.api_client.post(
            "/api/v1/deals/merge/",
            self._payload([self.source, self.source_extra]),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        result_deal_id = response.data["result_deal"]["id"]
        self.assertEqual(len(response.data["merged_deal_ids"]), 3)
        self.assertEqual(Task.objects.filter(deal_id=result_deal_id).count(), 1)
        self.assertEqual(Payment.objects.filter(deal_id=result_deal_id).count(), 1)
        self.assertFalse(Deal.objects.alive().filter(id=self.target.id).exists())
        self.assertFalse(Deal.objects.alive().filter(id=self.source.id).exists())
        self.assertFalse(Deal.objects.alive().filter(id=self.source_extra.id).exists())

    def test_merge_allows_specifying_client(self):
        self.authenticate(self.seller)
        response = self.api_client.post(
            "/api/v1/deals/merge/",
            self._payload([self.source, self.source_extra]),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            str(response.data["result_deal"]["client"]), str(self.client_obj.id)
        )

    def test_merge_requires_same_client(self):
        other_client = Client.objects.create(name="Other")
        other_source = Deal.objects.create(
            title="Foreign",
            client=other_client,
            seller=self.seller,
            status="open",
            stage_name="initial",
        )
        self.authenticate(self.seller)
        response = self.api_client.post(
            "/api/v1/deals/merge/",
            self._payload([self.source, other_source]),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("source_deal_ids", response.data)

    def test_merge_preview_returns_counts(self):
        self.authenticate(self.seller)
        response = self.api_client.post(
            "/api/v1/deals/merge/preview/",
            self._payload([self.source, self.source_extra], include_final_deal=False),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["moved_counts"]["tasks"], 1)
        self.assertEqual(response.data["moved_counts"]["payments"], 1)
        self.assertIn("final_deal_draft", response.data)
        self.assertIn("warnings", response.data)

    def test_merge_requires_owner(self):
        self.authenticate(self.other_user)
        response = self.api_client.post(
            "/api/v1/deals/merge/",
            self._payload([self.source, self.source_extra]),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_merge_audit_final_deal_client_id_is_string(self):
        self.authenticate(self.seller)
        response = self.api_client.post(
            "/api/v1/deals/merge/",
            self._payload([self.source, self.source_extra]),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        audit = AuditLog.objects.filter(action="merge").latest("created_at")
        self.assertEqual(
            audit.new_value["final_deal"]["client_id"], str(self.client_obj.id)
        )
        self.assertIsInstance(audit.new_value["final_deal"]["client_id"], str)

    def test_merge_preview_uses_earliest_dates_and_combined_description(self):
        self.target.description = "Target description"
        self.target.next_contact_date = datetime.date(2027, 2, 14)
        self.target.expected_close = datetime.date(2027, 4, 15)
        self.target.save(
            update_fields=["description", "next_contact_date", "expected_close"]
        )

        self.source.description = "Source A description"
        self.source.next_contact_date = datetime.date(2027, 2, 10)
        self.source.expected_close = datetime.date(2027, 4, 20)
        self.source.save(
            update_fields=["description", "next_contact_date", "expected_close"]
        )

        self.source_extra.description = "Source B description"
        self.source_extra.next_contact_date = datetime.date(2027, 2, 12)
        self.source_extra.expected_close = datetime.date(2027, 4, 10)
        self.source_extra.save(
            update_fields=["description", "next_contact_date", "expected_close"]
        )

        self.authenticate(self.seller)
        response = self.api_client.post(
            "/api/v1/deals/merge/preview/",
            self._payload([self.source, self.source_extra], include_final_deal=False),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        draft = response.data["final_deal_draft"]
        self.assertEqual(draft["next_contact_date"], "2027-02-10")
        self.assertEqual(draft["expected_close"], "2027-04-10")
        self.assertEqual(
            draft["description"],
            "Target description\nSource A description\nSource B description",
        )

    def test_merge_keeps_next_contact_when_payload_empty_and_allows_clearing_description(
        self,
    ):
        self.target.description = "Will be cleared"
        self.target.next_contact_date = datetime.date(2027, 2, 14)
        self.target.save(update_fields=["description", "next_contact_date"])

        payload = self._payload([self.source, self.source_extra])
        payload["final_deal"]["description"] = ""
        payload["final_deal"]["next_contact_date"] = None

        self.authenticate(self.seller)
        response = self.api_client.post("/api/v1/deals/merge/", payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        result_deal = Deal.objects.get(pk=response.data["result_deal"]["id"])
        self.assertEqual(result_deal.description, "")
        self.assertEqual(result_deal.next_contact_date, datetime.date(2027, 2, 14))

    def test_merge_preview_ignores_empty_dates_for_earliest(self):
        self.target.expected_close = datetime.date(2027, 4, 15)
        self.target.next_contact_date = datetime.date(2027, 2, 12)
        self.target.save(update_fields=["expected_close", "next_contact_date"])

        self.source.expected_close = None
        self.source.next_contact_date = datetime.date(2027, 2, 10)
        self.source.save(update_fields=["expected_close", "next_contact_date"])

        self.source_extra.expected_close = datetime.date(2027, 4, 10)
        self.source_extra.next_contact_date = datetime.date(2027, 2, 20)
        self.source_extra.save(update_fields=["expected_close", "next_contact_date"])

        self.authenticate(self.seller)
        response = self.api_client.post(
            "/api/v1/deals/merge/preview/",
            self._payload([self.source, self.source_extra], include_final_deal=False),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        draft = response.data["final_deal_draft"]
        self.assertEqual(draft["next_contact_date"], "2027-02-10")
        self.assertEqual(draft["expected_close"], "2027-04-10")

        self.target.expected_close = None
        self.target.save(update_fields=["expected_close"])
        self.source.expected_close = None
        self.source.save(update_fields=["expected_close"])
        self.source_extra.expected_close = None
        self.source_extra.save(update_fields=["expected_close"])

        response_all_empty = self.api_client.post(
            "/api/v1/deals/merge/preview/",
            self._payload([self.source, self.source_extra], include_final_deal=False),
            format="json",
        )

        self.assertEqual(response_all_empty.status_code, status.HTTP_200_OK)
        draft_all_empty = response_all_empty.data["final_deal_draft"]
        self.assertEqual(draft_all_empty["next_contact_date"], "2027-02-10")
        self.assertIsNone(draft_all_empty["expected_close"])
