import uuid
from unittest.mock import patch

from apps.clients.models import Client
from apps.deals.models import Deal, InsuranceCompany, InsuranceType, Quote
from apps.insurance_requests import models as domain
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIRequestFactory

from .lifecycle_views import LifecycleApplyView, LifecyclePreviewView
from .models import CodexReadKey, CodexWriteKey


class LifecycleTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username="lifecycle-test")
        with patch("apps.clients.signals.ensure_client_folder"), patch(
            "apps.deals.signals.ensure_deal_folder"
        ):
            self.client_record = Client.objects.create(
                name="Test client", created_by=self.user
            )
            self.deal = Deal.objects.create(
                title="Test deal", seller=self.user, client=self.client_record
            )
            self.other = Deal.objects.create(
                title="Other deal", seller=self.user, client=self.client_record
            )
        self.participant = domain.DealParticipant.objects.get(
            deal=self.deal, client=self.client_record
        )
        self.vehicle = domain.Vehicle.objects.create(deal=self.deal, title="Car")
        self.kind = InsuranceType.objects.create(name="CASCO")
        self.req = domain.InsuranceRequest.objects.create(
            deal=self.deal,
            title="Request",
            vehicle=self.vehicle,
            insurance_type=self.kind,
            owner=self.client_record,
        )
        self.key, self.token = CodexWriteKey.issue("Lifecycle test")
        self.factory = APIRequestFactory()

    def operation(self, entity="request", action="close", obj=None, **extra):
        return [
            {
                "ref": "target",
                "entity": entity,
                "id": str((obj or self.req).pk),
                "action": action,
                "source": "Explicit user request",
                **extra,
            }
        ]

    def preview(self, ops):
        request = self.factory.post(
            "/",
            {"operations": ops},
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.token}",
        )
        return LifecyclePreviewView.as_view()(request, deal_id=self.deal.pk)

    def apply(self, ops, preview, key=None, confirmations=None):
        request = self.factory.post(
            "/",
            {
                "operations": ops,
                "preview_token": preview.data["preview_token"],
                "confirmations": (
                    preview.data["confirmations"]
                    if confirmations is None
                    else confirmations
                ),
            },
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.token}",
            HTTP_IDEMPOTENCY_KEY=str(key or uuid.uuid4()),
        )
        return LifecycleApplyView.as_view()(request, deal_id=self.deal.pk)

    def execute(self, ops):
        preview = self.preview(ops)
        self.assertEqual(preview.status_code, 200, preview.data)
        result = self.apply(ops, preview)
        self.assertEqual(result.status_code, 201, result.data)
        return result

    def test_request_lifecycle_and_replay(self):
        for action in ["close", "reopen", "delete", "restore"]:
            ops = self.operation(action=action)
            preview = self.preview(ops)
            self.req.refresh_from_db()
            old = self.req.deleted_at
            key = uuid.uuid4()
            saved = self.apply(ops, preview, key)
            self.assertEqual(saved.status_code, 201, saved.data)
            replay = self.apply(ops, preview, key)
            self.assertTrue(replay.data["replayed"])
            self.assertEqual(saved.data["results"], replay.data["results"])
            if action == "delete":
                self.assertIsNone(old)
        self.req.refresh_from_db()
        self.assertFalse(self.req.is_current)
        self.assertIsNone(self.req.deleted_at)
        self.assertEqual(domain.RecordHistory.objects.count(), 4)

    def test_dependency_and_atomic_block(self):
        ops = self.operation("vehicle", "delete", self.vehicle)
        preview = self.preview(ops)
        self.assertEqual(
            preview.data["blockers"][0]["requests"][0]["id"], str(self.req.pk)
        )
        self.assertEqual(self.apply(ops, preview).status_code, 409)
        self.vehicle.refresh_from_db()
        self.assertIsNone(self.vehicle.deleted_at)

    def test_stale_and_foreign_record(self):
        ops = self.operation()
        preview = self.preview(ops)
        self.req.title = "Changed"
        self.req.save()
        self.assertEqual(self.apply(ops, preview).status_code, 409)
        foreign = domain.Vehicle.objects.create(deal=self.other, title="Foreign")
        self.assertEqual(
            self.preview(self.operation("vehicle", "delete", foreign)).status_code, 400
        )

    def test_shared_document_block_and_activation_confirmation(self):
        domain.DealParticipant.objects.get_or_create(
            deal=self.other, client=self.client_record
        )
        car = domain.Vehicle.objects.create(deal=self.other, title="Other car")
        other_request = domain.InsuranceRequest.objects.create(
            deal=self.other,
            title="Other request",
            vehicle=car,
            insurance_type=self.kind,
            owner=self.client_record,
        )
        old = domain.ClientPassport.objects.create(
            client=self.client_record, number="old"
        )
        new = domain.ClientPassport.objects.create(
            client=self.client_record, number="new", is_current=False
        )
        blocked = self.preview(self.operation("passport", "delete", old))
        ids = {r["id"] for r in blocked.data["blockers"][0]["requests"]}
        self.assertIn(str(other_request.pk), ids)
        ops = self.operation("passport", "activate", new)
        preview = self.preview(ops)
        self.assertEqual(len(preview.data["confirmations"]), 1)
        self.assertEqual(self.apply(ops, preview, confirmations=[]).status_code, 400)
        self.assertEqual(self.apply(ops, preview).status_code, 201)
        old.refresh_from_db()
        new.refresh_from_db()
        self.assertFalse(old.is_current)
        self.assertTrue(new.is_current)

    def test_reopen_rejects_unavailable_person_and_revoked_key(self):
        self.req.is_current = False
        self.req.save()
        self.participant.is_current = False
        self.participant.save()
        preview = self.preview(self.operation(action="reopen"))
        self.assertTrue(preview.data["blockers"])
        self.key.revoked_at = timezone.now()
        self.key.save()
        self.assertEqual(self.preview(self.operation()).status_code, 403)

    def test_read_key_invalid_key_and_unsupported_actions(self):
        saved = self.token
        _, reader = CodexReadKey.issue("Reader")
        for token in (reader, "invalid"):
            self.token = token
            self.assertEqual(self.preview(self.operation()).status_code, 403)
        self.token = saved
        for entity, action in [("client", "delete"), ("request", "activate")]:
            self.assertEqual(
                self.preview(self.operation(entity, action)).status_code, 400
            )

    def test_restore_document_inactive_and_participant_preserves_client(self):
        self.execute(self.operation(action="close"))
        doc = domain.ClientPassport.objects.create(client=self.client_record)
        for action in ("delete", "restore"):
            self.execute(self.operation("passport", action, doc))
        doc.refresh_from_db()
        self.assertFalse(doc.is_current)
        self.assertIsNone(doc.deleted_at)
        self.execute(self.operation("participant", "delete", self.participant))
        self.client_record.refresh_from_db()
        self.assertIsNone(self.client_record.deleted_at)
        self.assertTrue(domain.InsuranceRequest.objects.filter(pk=self.req.pk).exists())

    def test_batch_block_rolls_back_prior_mutation_and_reused_key_conflicts(self):
        ops = self.operation()
        preview = self.preview(ops)
        key = uuid.uuid4()
        self.assertEqual(self.apply(ops, preview, key).status_code, 201)
        changed = self.operation(action="reopen")
        self.assertEqual(
            self.apply(changed, self.preview(changed), key).status_code, 409
        )
        self.execute(changed)
        ops = self.operation("vehicle", "delete", self.vehicle)
        ops += [{**self.operation()[0], "ref": "second"}]
        p = self.preview(ops)
        self.assertEqual(self.apply(ops, p).status_code, 409)
        self.req.refresh_from_db()
        self.assertTrue(self.req.is_current)

    def make_variant(self):
        self.req.version = 1
        self.req.save()
        version = domain.RequestVersion.objects.create(
            insurance_request=self.req, number=1, snapshot={"original": True}
        )
        return domain.RequestVariant.objects.create(
            insurance_request=self.req,
            request_version=version,
            insurance_company=InsuranceCompany.objects.create(name="Test insurer"),
            platform=domain.Platform.objects.create(name="Test platform"),
        )

    def test_variant_status_reason_and_offers_protection(self):
        variant = self.make_variant()
        for status in ("declined", "failed"):
            ops = self.operation("variant", "set_status", variant, status=status)
            self.assertEqual(self.preview(ops).status_code, 400)
            ops[0]["explanation"] = "Platform returned a documented reason"
            self.execute(ops)
            variant.refresh_from_db()
            self.assertEqual(variant.status, status)
        self.execute(self.operation("variant", "set_status", variant, status="pending"))
        ops = self.operation("variant", "set_status", variant, status="quoted")
        self.assertEqual(self.preview(ops).status_code, 400)
        Quote.objects.create(
            deal=self.deal,
            insurance_company=variant.insurance_company,
            insurance_type=self.kind,
            request_variant=variant,
            insurance_request=self.req,
            request_version=variant.request_version,
            sum_insured=1000,
            premium=100,
        )
        ops[0]["status"] = "pending"
        self.assertTrue(self.preview(ops).data["blockers"])

    def test_delete_preserves_version_variant_and_restore_audit(self):
        variant = self.make_variant()
        self.execute(self.operation(action="delete"))
        self.assertTrue(domain.RequestVariant.objects.filter(pk=variant.pk).exists())
        self.assertEqual(
            domain.RequestVersion.objects.get(pk=variant.request_version_id).snapshot,
            {"original": True},
        )
        self.execute(self.operation(action="restore"))
        history = domain.RecordHistory.objects.filter(action="codex_lifecycle").last()
        self.assertEqual(history.snapshot["author"], "Codex")

    def test_registered_url_and_body_size(self):
        from rest_framework.test import APIClient

        api = APIClient()
        api.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token}")
        url = f"/api/v1/codex/write/deals/{self.deal.pk}/lifecycle/preview/"
        self.assertEqual(
            api.post(url, {"operations": self.operation()}, format="json").status_code,
            200,
        )
        self.assertEqual(
            api.post(
                url, {"operations": [], "padding": "x" * 262144}, format="json"
            ).status_code,
            400,
        )

    def test_document_activation_invalidates_snapshot_without_rewriting(self):
        from apps.insurance_requests.services import request_snapshot

        from .request_views import RequestPassportView

        old = domain.ClientPassport.objects.create(
            client=self.client_record, number="old"
        )
        new = domain.ClientPassport.objects.create(
            client=self.client_record, number="new", is_current=False
        )
        self.req.version = 1
        self.req.save()
        snapshot = request_snapshot(self.req)
        version = domain.RequestVersion.objects.create(
            insurance_request=self.req, number=1, snapshot=snapshot
        )
        self.execute(self.operation("passport", "activate", new))
        _, reader = CodexReadKey.issue("Reader")
        request = self.factory.get("/", HTTP_AUTHORIZATION=f"Bearer {reader}")
        response = RequestPassportView.as_view()(
            request, deal_id=self.deal.pk, request_id=self.req.pk
        )
        self.assertTrue(response.data["sources_changed"])
        version.refresh_from_db()
        self.assertEqual(version.snapshot, snapshot)
        self.assertEqual(version.snapshot["passports"][0]["id"], str(old.pk))

    def test_deleted_deal_and_tampered_preview(self):
        ops = self.operation()
        preview = self.preview(ops)
        changed = self.operation(action="delete")
        self.assertEqual(self.apply(changed, preview).status_code, 409)
        self.deal.deleted_at = timezone.now()
        Deal.objects.filter(pk=self.deal.pk).update(deleted_at=self.deal.deleted_at)
        self.assertEqual(self.preview(ops).status_code, 404)
