import uuid
from unittest.mock import patch

from apps.clients.models import Client
from apps.deals.models import Deal, InsuranceCompany, InsuranceType
from apps.insurance_requests.models import (
    ClientPassport,
    Platform,
    RecordHistory,
    Vehicle,
)
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from .models import CodexWriteKey


class PreparationTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username="preparer-test")
        with patch("apps.clients.signals.ensure_client_folder"), patch(
            "apps.deals.signals.ensure_deal_folder"
        ):
            self.person = Client.objects.create(name="Клиент", created_by=self.user)
            self.deal = Deal.objects.create(
                title="Сделка", client=self.person, seller=self.user
            )
        self.key, token = CodexWriteKey.issue("Test")
        self.api = APIClient()
        self.api.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        self.base = f"/api/v1/codex/write/deals/{self.deal.pk}/preparation/"

    def preview(self, ops):
        return self.api.post(self.base + "preview/", {"operations": ops}, format="json")

    def apply(self, ops, preview, confirmations=None, key=None):
        return self.api.post(
            self.base + "apply/",
            {
                "operations": ops,
                "preview_token": preview["preview_token"],
                "confirmations": (
                    preview["confirmations"] if confirmations is None else confirmations
                ),
            },
            format="json",
            HTTP_IDEMPOTENCY_KEY=str(key or uuid.uuid4()),
        )

    def test_new_client_participant_request_atomic_and_no_external_calls(self):
        company = InsuranceCompany.objects.create(name="РЕСО")
        kind = InsuranceType.objects.create(name="КАСКО")
        platform = Platform.objects.create(name="Office")
        ops = [
            {
                "ref": "person",
                "entity": "client",
                "source": "Паспорт",
                "data": {"name": "Новый человек", "birth_date": "1980-01-01"},
            },
            {
                "ref": "participant",
                "entity": "participant",
                "source": "Пользователь",
                "data": {"client": "@person"},
            },
            {
                "ref": "vehicle",
                "entity": "vehicle",
                "source": "СТС",
                "data": {"title": "Авто", "vin": "LVTDD24B4RD661693"},
            },
            {
                "ref": "request",
                "entity": "request",
                "source": "Пользователь",
                "data": {
                    "title": "Расчёт",
                    "insurance_type": str(kind.pk),
                    "vehicle": "@vehicle",
                    "policyholder": "@person",
                    "owner": "@person",
                    "drivers": ["@person"],
                    "targets": [
                        {
                            "insurance_company": str(company.pk),
                            "platform": str(platform.pk),
                        }
                    ],
                    "deductibles": ["0"],
                    "official_dealer": True,
                    "vehicle_value_mode": "maximum",
                },
            },
        ]
        with patch("apps.clients.signals.ensure_client_folder") as drive:
            preview = self.preview(ops)
            self.assertEqual(preview.status_code, 200, preview.data)
            self.assertFalse(Client.objects.filter(name="Новый человек").exists())
            self.assertFalse(Vehicle.objects.exists())
            response = self.apply(ops, preview.data)
            self.assertEqual(response.status_code, 201, response.data)
            self.assertEqual(response.data["results"], preview.data["results"])
            self.assertTrue(Client.objects.filter(name="Новый человек").exists())
            self.assertEqual(
                Client.objects.get(name="Новый человек").created_by_id, self.user.pk
            )
            drive.assert_not_called()
        self.assertEqual(
            RecordHistory.objects.filter(action="codex_prepare").count(), 4
        )

    def test_replacements_confirmations_stale_and_replay(self):
        ops = [
            {
                "ref": "person",
                "entity": "client",
                "id": str(self.person.pk),
                "source": "Исправленный паспорт",
                "data": {"name": "Другое имя"},
            }
        ]
        preview = self.preview(ops)
        self.assertEqual(preview.status_code, 200, preview.data)
        self.assertEqual(preview.data["confirmations"][0]["old"], "Клиент")
        self.assertEqual(
            self.apply(ops, preview.data, confirmations=[]).status_code, 400
        )
        self.person.refresh_from_db()
        self.assertEqual(self.person.name, "Клиент")
        idem = uuid.uuid4()
        response = self.apply(ops, preview.data, key=idem)
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(self.apply(ops, preview.data, key=idem).status_code, 200)
        self.assertEqual(self.apply(ops, preview.data).status_code, 409)

    def test_document_activation_and_readonly_rejection(self):
        old = ClientPassport.objects.create(client=self.person, number="1")
        ops = [
            {
                "ref": "passport",
                "entity": "passport",
                "source": "Новый паспорт",
                "data": {"client": str(self.person.pk), "number": "2"},
            }
        ]
        preview = self.preview(ops)
        self.assertEqual(preview.status_code, 200, preview.data)
        self.assertEqual(
            preview.data["confirmations"][0]["field"], "deactivate_document"
        )
        old.refresh_from_db()
        self.assertTrue(old.is_current)
        self.assertEqual(self.apply(ops, preview.data).status_code, 201)
        old.refresh_from_db()
        self.assertFalse(old.is_current)
        ops[0]["data"]["deleted_at"] = None
        self.assertEqual(self.preview(ops).status_code, 400)

    def test_invalid_tail_rolls_back_and_foreign_deal_rejected(self):
        ops = [
            {
                "ref": "v",
                "entity": "vehicle",
                "source": "СТС",
                "data": {"title": "Авто"},
            },
            {
                "ref": "p",
                "entity": "participant",
                "source": "Пользователь",
                "data": {"client": str(uuid.uuid4())},
            },
        ]
        self.assertEqual(self.preview(ops).status_code, 400)
        self.assertFalse(Vehicle.objects.exists())
        ops = [
            {
                "ref": "v",
                "entity": "vehicle",
                "source": "СТС",
                "data": {"title": "Авто", "deal": str(uuid.uuid4())},
            }
        ]
        self.assertEqual(self.preview(ops).status_code, 400)
