"""Independent boundary tests for the two-step preparation writer."""

import copy
import uuid
from unittest.mock import patch

from apps.clients.models import Client
from apps.deals.models import Deal
from apps.insurance_requests.models import ClientPassport, RecordHistory, Vehicle
from django.core import signing
from rest_framework.test import APITestCase

from .models import CodexReadKey, CodexWriteKey


class PreparationReviewTests(APITestCase):
    def setUp(self):
        for name in (
            "apps.clients.signals.ensure_client_folder",
            "apps.deals.signals.ensure_deal_folder",
        ):
            mock = patch(name)
            mock.start()
            self.addCleanup(mock.stop)
        self.key, self.token = CodexWriteKey.issue("review")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token}")
        self.person = Client.objects.create(name="Проверочный клиент")
        self.deal = Deal.objects.create(title="Проверочная сделка", client=self.person)
        self.base = f"/api/v1/codex/write/deals/{self.deal.pk}/preparation/"

    def operation(self, entity, data, record_id=None, ref="item"):
        op = {
            "ref": ref,
            "entity": entity,
            "data": data,
            "source": "Документ, страница 1",
        }
        if record_id:
            op["id"] = str(record_id)
        return op

    def preview(self, operations):
        response = self.client.post(
            self.base + "preview/", {"operations": operations}, format="json"
        )
        self.assertEqual(response.status_code, 200, response.data)
        return response.data

    def apply(self, operations, preview, confirmations=None, key=None):
        return self.client.post(
            self.base + "apply/",
            {
                "operations": operations,
                "preview_token": preview["preview_token"],
                "confirmations": (
                    preview["confirmations"] if confirmations is None else confirmations
                ),
            },
            format="json",
            HTTP_IDEMPOTENCY_KEY=str(key or uuid.uuid4()),
        )

    def test_false_and_zero_are_replacements_not_empty(self):
        vehicle = Vehicle.objects.create(
            deal=self.deal, title="Машина", key_count=0, has_no_plate=False
        )
        ops = [
            self.operation(
                "vehicle", {"key_count": 2, "has_no_plate": True}, vehicle.pk
            )
        ]
        preview = self.preview(ops)
        fields = {item["field"] for item in preview["confirmations"]}
        self.assertEqual(fields, {"key_count", "has_no_plate"})
        vehicle.refresh_from_db()
        self.assertEqual(vehicle.key_count, 0)
        result = self.apply(ops, preview, [])
        self.assertEqual(result.status_code, 400, result.data)
        vehicle.refresh_from_db()
        self.assertFalse(vehicle.has_no_plate)

    def test_activation_confirmation_is_exact_and_preview_keeps_current_document(self):
        old = ClientPassport.objects.create(client=self.person, number="old")
        ops = [
            self.operation("passport", {"client": str(self.person.pk), "number": "new"})
        ]
        count = RecordHistory.objects.count()
        preview = self.preview(ops)
        old.refresh_from_db()
        self.assertTrue(old.is_current)
        self.assertEqual(ClientPassport.objects.count(), 1)
        self.assertEqual(RecordHistory.objects.count(), count)
        forged = copy.deepcopy(preview["confirmations"])
        forged[0]["source"] = "Другой источник"
        response = self.apply(ops, preview, forged)
        self.assertEqual(response.status_code, 400, response.data)
        self.assertEqual(ClientPassport.objects.count(), 1)

    def test_concurrent_source_change_invalidates_even_fill_only_preview(self):
        ops = [self.operation("client", {"phone": "123"}, self.person.pk)]
        preview = self.preview(ops)
        Client.objects.filter(pk=self.person.pk).update(phone="456")
        response = self.apply(ops, preview)
        self.assertEqual(response.status_code, 409, response.data)
        self.person.refresh_from_db()
        self.assertEqual(self.person.phone, "456")

    def test_changed_operations_do_not_reuse_confirmation(self):
        ops = [self.operation("client", {"phone": "123"}, self.person.pk)]
        preview = self.preview(ops)
        ops[0]["data"]["phone"] = "999"
        response = self.apply(ops, preview)
        self.assertIn(response.status_code, (400, 409), response.data)
        self.person.refresh_from_db()
        self.assertEqual(self.person.phone, "")

    def test_read_key_cannot_preview_or_apply(self):
        ops = [self.operation("client", {"phone": "123"}, self.person.pk)]
        preview = self.preview(ops)
        _, read_token = CodexReadKey.issue("review-read")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {read_token}")
        response = self.client.post(
            self.base + "preview/", {"operations": ops}, format="json"
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(self.apply(ops, preview).status_code, 403)

    def test_preview_rejects_late_invalid_operation_without_partial_write(self):
        ops = [
            self.operation("client", {"phone": "123"}, self.person.pk, "person"),
            self.operation("vehicle", {"title": "Машина", "vin": "INVALID"}),
        ]
        response = self.client.post(
            self.base + "preview/", {"operations": ops}, format="json"
        )
        self.assertEqual(response.status_code, 400, response.data)
        self.person.refresh_from_db()
        self.assertEqual(self.person.phone, "")
        self.assertEqual(Vehicle.objects.count(), 0)

    def test_replay_after_newer_edit_returns_original_ids_without_overwrite(self):
        ops = [self.operation("client", {"phone": "123"}, self.person.pk)]
        preview = self.preview(ops)
        key = uuid.uuid4()
        response = self.apply(ops, preview, key=key)
        self.assertEqual(response.status_code, 201, response.data)
        Client.objects.filter(pk=self.person.pk).update(phone="456")
        repeated = self.apply(ops, preview, key=key)
        self.assertEqual(repeated.status_code, 200, repeated.data)
        self.assertTrue(repeated.data["replayed"])
        self.person.refresh_from_db()
        self.assertEqual(self.person.phone, "456")

    def test_preview_cannot_be_used_by_another_write_key(self):
        ops = [self.operation("client", {"phone": "123"}, self.person.pk)]
        preview = self.preview(ops)
        _, token = CodexWriteKey.issue("other-review-key")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        self.assertEqual(self.apply(ops, preview).status_code, 409)
        self.person.refresh_from_db()
        self.assertEqual(self.person.phone, "")

    def test_expired_preview_rejected_without_write(self):
        ops = [self.operation("client", {"phone": "123"}, self.person.pk)]
        preview = self.preview(ops)
        with patch(
            "apps.codex_reader.preparation_views.signing.loads",
            side_effect=signing.SignatureExpired("expired"),
        ):
            response = self.apply(ops, preview)
        self.assertEqual(response.status_code, 409)
        self.person.refresh_from_db()
        self.assertEqual(self.person.phone, "")

    def test_same_passport_duplicate_is_rejected(self):
        ClientPassport.objects.create(
            client=self.person, series="1234", number="123456"
        )
        ops = [
            self.operation(
                "passport",
                {"client": str(self.person.pk), "series": "1234", "number": "123456"},
            )
        ]
        response = self.client.post(
            self.base + "preview/", {"operations": ops}, format="json"
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(ClientPassport.objects.count(), 1)

    def test_vehicle_from_another_deal_cannot_be_filled(self):
        other = Deal.objects.create(title="Чужая", client=self.person)
        vehicle = Vehicle.objects.create(deal=other, title="Машина")
        ops = [self.operation("vehicle", {"brand": "Марка"}, vehicle.pk)]
        response = self.client.post(
            self.base + "preview/", {"operations": ops}, format="json"
        )
        self.assertEqual(response.status_code, 400)
        vehicle.refresh_from_db()
        self.assertEqual(vehicle.brand, "")
