import datetime
from unittest.mock import patch

from apps.chat.models import ChatMessage
from apps.clients.models import Client
from apps.common.drive import DriveOperationError
from apps.common.tests.auth_utils import AuthenticatedAPITestCase
from apps.deals.models import (
    Deal,
    DealEvent,
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
            },
        )
        self.assertEqual(result["warnings"], [])

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

    def test_merge_recalculates_deadline_from_moved_policy(self):
        Policy.objects.create(
            number="P-DEADLINE",
            insurance_company=InsuranceCompany.objects.create(name="Deadline Comp"),
            insurance_type=InsuranceType.objects.create(name="Deadline Type"),
            deal=self.source,
            end_date=datetime.date(2027, 4, 12),
        )

        result = DealMergeService(
            target_deal=self.target,
            source_deals=[self.source],
            final_deal_data={
                "title": "Merged deadline deal",
                "client_id": self.client_obj.id,
                "seller_id": self.user.id,
                "expected_close": None,
            },
            actor=self.user,
        ).merge()

        self.assertEqual(
            result["result_deal"].expected_close, datetime.date(2027, 4, 12)
        )

    def test_merge_recalculates_deadline_from_moved_unpaid_payment(self):
        Payment.objects.create(
            amount=100,
            deal=self.source,
            scheduled_date=datetime.date(2027, 4, 12),
        )

        result = DealMergeService(
            target_deal=self.target,
            source_deals=[self.source],
            final_deal_data={
                "title": "Merged payment deadline deal",
                "client_id": self.client_obj.id,
                "seller_id": self.user.id,
                "expected_close": None,
            },
            actor=self.user,
        ).merge()

        self.assertEqual(
            result["result_deal"].expected_close, datetime.date(2027, 4, 12)
        )

    def test_merge_leaves_deadline_empty_without_deadline_sources(self):
        result = DealMergeService(
            target_deal=self.target,
            source_deals=[self.source],
            final_deal_data={
                "title": "Merged without deadline",
                "client_id": self.client_obj.id,
                "seller_id": self.user.id,
                "expected_close": datetime.date(2027, 4, 12),
            },
            actor=self.user,
        ).merge()

        self.assertIsNone(result["result_deal"].expected_close)

    def test_merge_copies_manual_deadline_events_and_preserves_provenance(self):
        second_source = Deal.objects.create(
            title="Second source deal",
            client=self.client_obj,
            seller=self.user,
            status="open",
            stage_name="initial",
        )
        second_user = User.objects.create_user(username="second-merge-user")
        target_event = DealEvent.objects.create(
            deal=self.target,
            event_type=DealEvent.EventType.MANUAL_EXPECTED_CLOSE,
            event_date=datetime.date(2027, 4, 20),
            title="Target manual deadline",
            description="Target description",
            actor=self.user,
            metadata={"reason": "target"},
        )
        source_event = DealEvent.objects.create(
            deal=self.source,
            event_type=DealEvent.EventType.MANUAL_EXPECTED_CLOSE,
            event_date=datetime.date(2027, 4, 12),
            title="Source manual deadline",
            description="Source description",
            actor=second_user,
            metadata={"reason": "source"},
        )
        second_source_event = DealEvent.objects.create(
            deal=second_source,
            event_type=DealEvent.EventType.MANUAL_EXPECTED_CLOSE,
            event_date=datetime.date(2027, 4, 16),
            title="Second source manual deadline",
            actor=self.user,
        )
        Policy.objects.create(
            number="P-MANUAL-DEADLINE",
            insurance_company=InsuranceCompany.objects.create(name="Manual Comp"),
            insurance_type=InsuranceType.objects.create(name="Manual Type"),
            deal=self.source,
            end_date=datetime.date(2027, 4, 15),
        )
        Payment.objects.create(
            amount=100,
            deal=self.source,
            scheduled_date=datetime.date(2027, 4, 10),
        )

        result = DealMergeService(
            target_deal=self.target,
            source_deals=[self.source, second_source],
            final_deal_data={
                "title": "Merged manual deadline deal",
                "client_id": self.client_obj.id,
                "seller_id": self.user.id,
            },
            actor=self.user,
        ).merge()

        result_deal = result["result_deal"]
        copied_events = list(
            DealEvent.objects.filter(deal=result_deal).order_by("event_date")
        )
        self.assertEqual(len(copied_events), 3)
        copied_by_source_id = {event.source_id: event for event in copied_events}
        for source_event_value in [target_event, source_event, second_source_event]:
            copied = copied_by_source_id[str(source_event_value.id)]
            self.assertNotEqual(copied.id, source_event_value.id)
            self.assertEqual(copied.event_date, source_event_value.event_date)
            self.assertEqual(copied.title, source_event_value.title)
            self.assertEqual(copied.description, source_event_value.description)
            self.assertEqual(copied.actor_id, source_event_value.actor_id)
            self.assertEqual(copied.source_type, "deal_merge")
            self.assertEqual(
                copied.metadata["source_deal_id"], str(source_event_value.deal_id)
            )
            self.assertEqual(
                copied.metadata["source_event_id"], str(source_event_value.id)
            )

        self.assertEqual(
            copied_by_source_id[str(source_event.id)].metadata["source_event_metadata"],
            {"reason": "source"},
        )
        self.assertEqual(target_event.deal_id, self.target.id)
        self.assertEqual(source_event.deal_id, self.source.id)
        self.assertEqual(second_source_event.deal_id, second_source.id)
        self.assertEqual(result_deal.manual_expected_close, datetime.date(2027, 4, 12))
        self.assertEqual(result_deal.expected_close, datetime.date(2027, 4, 10))

    def test_merge_materializes_legacy_manual_deadline_without_matching_event(self):
        self.source.manual_expected_close = datetime.date(2027, 4, 12)
        self.source.save(update_fields=["manual_expected_close"])
        DealEvent.objects.create(
            deal=self.source,
            event_type=DealEvent.EventType.MANUAL_EXPECTED_CLOSE,
            event_date=datetime.date(2027, 4, 13),
            title="Different manual deadline",
        )

        result = DealMergeService(
            target_deal=self.target,
            source_deals=[self.source],
            final_deal_data={
                "title": "Merged legacy manual deadline deal",
                "client_id": self.client_obj.id,
                "seller_id": self.user.id,
            },
            actor=self.user,
        ).merge()

        legacy_event = DealEvent.objects.get(
            deal=result["result_deal"],
            event_date=datetime.date(2027, 4, 12),
        )
        self.assertEqual(legacy_event.title, "Крайний срок из старых данных")
        self.assertEqual(legacy_event.source_type, "deal_merge")
        self.assertEqual(legacy_event.source_id, str(self.source.id))
        self.assertEqual(
            legacy_event.metadata["origin"],
            "deal_merge_legacy_manual_expected_close",
        )
        self.assertEqual(
            result["result_deal"].manual_expected_close, datetime.date(2027, 4, 12)
        )

    def test_merge_does_not_duplicate_legacy_deadline_with_matching_event(self):
        self.source.manual_expected_close = datetime.date(2027, 4, 12)
        self.source.save(update_fields=["manual_expected_close"])
        source_event = DealEvent.objects.create(
            deal=self.source,
            event_type=DealEvent.EventType.MANUAL_EXPECTED_CLOSE,
            event_date=datetime.date(2027, 4, 12),
            title="Existing manual deadline",
        )

        result = DealMergeService(
            target_deal=self.target,
            source_deals=[self.source],
            final_deal_data={
                "title": "Merged matching legacy deadline deal",
                "client_id": self.client_obj.id,
                "seller_id": self.user.id,
            },
            actor=self.user,
        ).merge()

        copied_events = DealEvent.objects.filter(deal=result["result_deal"])
        self.assertEqual(copied_events.count(), 1)
        copied_event = copied_events.get()
        self.assertEqual(copied_event.source_id, str(source_event.id))
        self.assertEqual(
            copied_event.metadata["origin"], "deal_merge_manual_expected_close"
        )

    def test_merge_does_not_duplicate_ids_block_when_already_present(self):
        ids_block = f"Предыдущие ID сделок: {self.target.id}, {self.source.id}"
        result = DealMergeService(
            target_deal=self.target,
            source_deals=[self.source],
            final_deal_data={
                "title": "Merged Deal",
                "client_id": self.client_obj.id,
                "seller_id": self.user.id,
                "description": f"Описание сделки\n\n{ids_block}",
            },
            actor=self.user,
        ).merge()

        result_deal = result["result_deal"]
        self.assertEqual(result_deal.description, f"Описание сделки\n\n{ids_block}")

    @patch("apps.deals.services.try_delete_drive_folder")
    @patch("apps.deals.services.move_drive_folder_contents_verified")
    @patch("apps.deals.services.ensure_deal_folder")
    @patch("apps.deals.services.is_drive_oauth_configured")
    def test_merge_returns_warning_when_delete_fails_after_verified_move(
        self,
        is_drive_oauth_configured_mock,
        ensure_deal_folder_mock,
        move_drive_folder_contents_verified_mock,
        try_delete_drive_folder_mock,
    ):
        self.target.drive_folder_id = "target-folder"
        self.target.save(update_fields=["drive_folder_id"])
        self.source.drive_folder_id = "source-folder"
        self.source.save(update_fields=["drive_folder_id"])

        is_drive_oauth_configured_mock.return_value = True
        ensure_deal_folder_mock.side_effect = lambda deal: deal.drive_folder_id
        move_drive_folder_contents_verified_mock.return_value = {
            "source_before_count": 2,
            "source_after_count": 0,
            "target_before_count": 3,
            "target_after_count": 5,
        }
        try_delete_drive_folder_mock.return_value = {
            "deleted": False,
            "error": "Unable to delete Drive folder.",
        }

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

        self.assertEqual(len(result["warnings"]), 1)
        self.assertIn("source-folder", result["warnings"][0])
        self.assertTrue(Deal.objects.with_deleted().get(pk=self.target.pk).is_deleted())
        self.assertTrue(Deal.objects.with_deleted().get(pk=self.source.pk).is_deleted())

    @patch("apps.deals.services.move_drive_folder_contents_verified")
    @patch("apps.deals.services.ensure_deal_folder")
    @patch("apps.deals.services.is_drive_oauth_configured")
    def test_merge_fails_when_drive_transfer_verification_fails(
        self,
        is_drive_oauth_configured_mock,
        ensure_deal_folder_mock,
        move_drive_folder_contents_verified_mock,
    ):
        self.target.drive_folder_id = "target-folder"
        self.target.save(update_fields=["drive_folder_id"])
        self.source.drive_folder_id = "source-folder"
        self.source.save(update_fields=["drive_folder_id"])

        is_drive_oauth_configured_mock.return_value = True
        ensure_deal_folder_mock.side_effect = lambda deal: deal.drive_folder_id
        move_drive_folder_contents_verified_mock.side_effect = DriveOperationError(
            "Drive folder transfer verification failed: source folder is not empty."
        )

        with self.assertRaises(DriveOperationError):
            DealMergeService(
                target_deal=self.target,
                source_deals=[self.source],
                final_deal_data={
                    "title": "Merged Deal",
                    "client_id": self.client_obj.id,
                    "seller_id": self.user.id,
                },
                actor=self.user,
            ).merge()

        self.assertTrue(Deal.objects.alive().filter(pk=self.target.pk).exists())
        self.assertTrue(Deal.objects.alive().filter(pk=self.source.pk).exists())
        self.assertFalse(Deal.objects.filter(title="Merged Deal").exists())


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

    def _merged_ids_block(self, sources):
        ids = [str(self.target.id), *[str(deal.id) for deal in sources]]
        return f"Предыдущие ID сделок: {', '.join(ids)}"

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
        self.assertEqual(response.data["warnings"], [])

    @patch("apps.deals.services.try_delete_drive_folder")
    @patch("apps.deals.services.move_drive_folder_contents_verified")
    @patch("apps.deals.services.ensure_deal_folder")
    @patch("apps.deals.services.is_drive_oauth_configured")
    def test_merge_returns_warning_in_api_response_when_folder_delete_fails(
        self,
        is_drive_oauth_configured_mock,
        ensure_deal_folder_mock,
        move_drive_folder_contents_verified_mock,
        try_delete_drive_folder_mock,
    ):
        self.target.drive_folder_id = "target-folder"
        self.target.save(update_fields=["drive_folder_id"])
        self.source.drive_folder_id = "source-folder"
        self.source.save(update_fields=["drive_folder_id"])

        is_drive_oauth_configured_mock.return_value = True
        ensure_deal_folder_mock.side_effect = lambda deal: deal.drive_folder_id
        move_drive_folder_contents_verified_mock.return_value = {
            "source_before_count": 1,
            "source_after_count": 0,
            "target_before_count": 0,
            "target_after_count": 1,
        }
        try_delete_drive_folder_mock.return_value = {
            "deleted": False,
            "error": "Unable to delete Drive folder.",
        }

        self.authenticate(self.seller)
        response = self.api_client.post(
            "/api/v1/deals/merge/",
            self._payload([self.source]),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["warnings"]), 1)
        self.assertIn("source-folder", response.data["warnings"][0])

    @patch("apps.deals.services.move_drive_folder_contents_verified")
    @patch("apps.deals.services.ensure_deal_folder")
    @patch("apps.deals.services.is_drive_oauth_configured")
    def test_merge_returns_503_when_drive_transfer_verification_fails(
        self,
        is_drive_oauth_configured_mock,
        ensure_deal_folder_mock,
        move_drive_folder_contents_verified_mock,
    ):
        self.target.drive_folder_id = "target-folder"
        self.target.save(update_fields=["drive_folder_id"])
        self.source.drive_folder_id = "source-folder"
        self.source.save(update_fields=["drive_folder_id"])

        is_drive_oauth_configured_mock.return_value = True
        ensure_deal_folder_mock.side_effect = lambda deal: deal.drive_folder_id
        move_drive_folder_contents_verified_mock.side_effect = DriveOperationError(
            "Drive folder transfer verification failed: source folder is not empty."
        )

        self.authenticate(self.seller)
        response = self.api_client.post(
            "/api/v1/deals/merge/",
            self._payload([self.source]),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertIn("detail", response.data)
        self.assertTrue(Deal.objects.alive().filter(pk=self.target.pk).exists())
        self.assertTrue(Deal.objects.alive().filter(pk=self.source.pk).exists())

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
        self.assertEqual(draft["next_contact_date"], datetime.date(2027, 2, 10))
        self.assertEqual(draft["expected_close"], datetime.date(2027, 4, 10))
        ids_block = self._merged_ids_block([self.source, self.source_extra])
        self.assertEqual(
            draft["description"],
            "Target description\nSource A description\nSource B description"
            f"\n\n{ids_block}",
        )

    def test_merge_keeps_next_contact_when_payload_empty_and_sets_ids_only_description(
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
        self.assertEqual(
            result_deal.description,
            self._merged_ids_block([self.source, self.source_extra]),
        )
        self.assertEqual(result_deal.next_contact_date, datetime.date(2027, 2, 14))

    def test_merge_appends_ids_block_in_target_then_source_order(self):
        payload = self._payload([self.source, self.source_extra])
        payload["final_deal"]["description"] = "Итоговое описание"

        self.authenticate(self.seller)
        response = self.api_client.post("/api/v1/deals/merge/", payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        result_deal = Deal.objects.get(pk=response.data["result_deal"]["id"])
        self.assertEqual(
            result_deal.description,
            "Итоговое описание\n\n"
            + self._merged_ids_block([self.source, self.source_extra]),
        )

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
        self.assertEqual(draft["next_contact_date"], datetime.date(2027, 2, 10))
        self.assertEqual(draft["expected_close"], datetime.date(2027, 4, 10))

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
        self.assertEqual(
            draft_all_empty["next_contact_date"], datetime.date(2027, 2, 10)
        )
        self.assertIsNone(draft_all_empty["expected_close"])
