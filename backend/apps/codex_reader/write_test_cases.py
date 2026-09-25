import hashlib
import json
import uuid
from decimal import Decimal
from unittest.mock import patch

from apps.clients.models import Client
from apps.deals.models import Deal, InsuranceCompany, InsuranceType, Quote
from apps.notes.models import Note
from rest_framework.test import APITestCase

from .models import CodexReadKey, CodexWriteKey, CodexWriteRequest


class CodexWriteApiTests(APITestCase):
    def setUp(self):
        for target in (
            "apps.clients.signals.ensure_client_folder",
            "apps.deals.signals.ensure_deal_folder",
        ):
            mocked = patch(target, return_value=None)
            mocked.start()
            self.addCleanup(mocked.stop)
        self.key, self.token = CodexWriteKey.issue("test writer")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token}")
        customer = Client.objects.create(name="Кусаева")
        self.deal = Deal.objects.create(title="Ипотека Сбербанк", client=customer)
        self.other_deal = Deal.objects.create(title="Другая сделка", client=customer)
        self.note_url = f"/api/v1/codex/write/deals/{self.deal.id}/notes/"
        self.offers_url = f"/api/v1/codex/write/deals/{self.deal.id}/offers/"
        self.payload = {
            "platform": "Pampadu",
            "calculation_url": "https://agents.pampadu.ru/app/ipoteka/example",
            "period_start": "2026-09-25",
            "period_end": "2027-09-24",
            "note": "Расчёт Pampadu сохранён.",
            "offers": [
                {
                    "insurance_company": "Росгосстрах",
                    "insurance_type": "Ипотека / жизнь",
                    "premium": "3624.00",
                    "sum_insured": "2237290.58",
                    "status": "refined",
                },
                {
                    "insurance_company": "РЕСО",
                    "insurance_type": "Ипотека / жизнь",
                    "premium": "4020.00",
                    "sum_insured": "2237290.58",
                    "status": "preliminary",
                },
            ],
        }

    def post(self, url, data, key=None):
        return self.client.post(
            url,
            data,
            format="json",
            HTTP_IDEMPOTENCY_KEY=str(key or uuid.uuid4()),
        )

    def test_batch_creates_all_offers_and_note_atomically(self):
        self.deal.status = Deal.DealStatus.WON
        self.deal.save()
        response = self.post(self.offers_url, self.payload)
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(len(response.data["quote_ids"]), 2)
        self.assertFalse(response.data["replayed"])
        self.assertEqual(Quote.objects.filter(deal=self.deal).count(), 2)
        self.assertEqual(Note.objects.get(deal=self.deal).author_name, "Codex")
        self.assertEqual(InsuranceCompany.objects.count(), 2)
        self.assertEqual(InsuranceType.objects.count(), 1)
        quote = Quote.objects.get(premium=Decimal("3624.00"))
        self.assertIn("уточнённый", quote.comments)
        self.assertIn("Создано: Codex", quote.comments)
        self.assertIn(self.payload["calculation_url"], quote.comments)
        self.assertIn("25.09.2026", quote.comments)

    def test_idempotency_replay_and_conflicting_payload(self):
        key = uuid.uuid4()
        first = self.post(self.offers_url, self.payload, key)
        second = self.post(self.offers_url, self.payload, key)
        self.assertEqual((first.status_code, second.status_code), (201, 200))
        self.assertEqual(first.data["quote_ids"], second.data["quote_ids"])
        self.assertTrue(second.data["replayed"])
        changed = {**self.payload, "note": "Another result"}
        self.assertEqual(self.post(self.offers_url, changed, key).status_code, 409)
        self.assertEqual(Quote.objects.count(), 2)
        self.assertEqual(Note.objects.count(), 1)
        self.assertEqual(CodexWriteRequest.objects.count(), 1)

    def test_kasko_fields_are_saved_and_read_back(self):
        offer = {
            **self.payload["offers"][0],
            "insurance_type": "КАСКО",
            "official_dealer": True,
            "deductible": "0.00",
        }
        response = self.post(self.offers_url, {**self.payload, "offers": [offer]})
        self.assertEqual(response.status_code, 201, response.data)
        quote = Quote.objects.get(pk=response.data["quote_ids"][0])
        self.assertTrue(quote.official_dealer)
        self.assertEqual(quote.deductible, Decimal("0.00"))

        _, read_token = CodexReadKey.issue("reader")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {read_token}")
        read_response = self.client.get(
            f"/api/v1/codex/deals/{self.deal.id}/sections/quotes/"
        )
        self.assertEqual(read_response.status_code, 200)
        saved = read_response.data["results"][0]
        self.assertTrue(saved["official_dealer"])
        self.assertEqual(saved["deductible"], "0.00")

    def test_kasko_requires_verified_dealer_and_deductible(self):
        base = {**self.payload["offers"][0], "insurance_type": "КАСКО"}
        variants = (
            base,
            {**base, "official_dealer": False},
            {**base, "deductible": "0.00"},
            {**base, "official_dealer": True, "deductible": None},
            {**base, "official_dealer": True, "deductible": "-1.00"},
        )
        for offer in variants:
            with self.subTest(offer=offer):
                response = self.post(
                    self.offers_url, {**self.payload, "offers": [offer]}
                )
                self.assertEqual(response.status_code, 400, response.data)
        self.assertEqual(Quote.objects.count(), 0)
        self.assertEqual(Note.objects.count(), 0)

    def test_legacy_kasko_request_replays_before_new_validation(self):
        legacy = {
            **self.payload,
            "offers": [{**self.payload["offers"][0], "insurance_type": "КАСКО"}],
        }
        request_id = uuid.uuid4()
        request_hash = hashlib.sha256(
            json.dumps(
                {"deal_id": str(self.deal.id), "operation": "offers", "data": legacy},
                ensure_ascii=False,
                sort_keys=True,
                separators=(",", ":"),
            ).encode("utf-8")
        ).hexdigest()
        company = InsuranceCompany.objects.create(name="Росгосстрах")
        insurance_type = InsuranceType.objects.create(name="КАСКО")
        quote = Quote.objects.create(
            deal=self.deal,
            insurance_company=company,
            insurance_type=insurance_type,
            premium=Decimal("3624.00"),
        )
        note = Note.objects.create(deal=self.deal, body="Прежний расчёт")
        CodexWriteRequest.objects.create(
            key=self.key,
            idempotency_key=request_id,
            request_hash=request_hash,
            response={"note_id": str(note.id), "quote_ids": [str(quote.id)]},
        )
        response = self.post(self.offers_url, legacy, request_id)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(response.data["replayed"])
        self.assertEqual(response.data["quote_ids"], [str(quote.id)])
        self.assertEqual(Quote.objects.count(), 1)
        self.assertEqual(Note.objects.count(), 1)

    def test_note_only_and_no_cross_endpoint_key_reuse(self):
        key = uuid.uuid4()
        first = self.post(self.note_url, {"body": "Готово"}, key)
        self.assertEqual(first.status_code, 201)
        self.assertEqual(first.data["quote_ids"], [])
        self.assertEqual(
            self.post(self.note_url, {"body": "Готово"}, key).status_code, 200
        )
        self.assertEqual(self.post(self.offers_url, self.payload, key).status_code, 409)
        self.assertEqual(Note.objects.count(), 1)

    def test_read_key_cannot_write_and_write_key_cannot_read(self):
        _, read_token = CodexReadKey.issue("reader")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {read_token}")
        self.assertEqual(self.post(self.note_url, {"body": "test"}).status_code, 403)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token}")
        read_url = f"/api/v1/codex/deals/{self.deal.id}/"
        self.assertEqual(self.client.get(read_url).status_code, 403)
        self.assertEqual(self.client.get(self.note_url).status_code, 405)
        self.assertEqual(self.client.put(self.note_url, {}).status_code, 405)
        self.assertEqual(self.client.delete(self.note_url).status_code, 405)
        self.key.revoke()
        self.assertEqual(self.post(self.note_url, {"body": "test"}).status_code, 403)
        self.assertEqual(Note.objects.count(), 0)

    def test_deleted_deal_and_foreign_identifiers_rejected(self):
        deleted_url = f"/api/v1/codex/write/deals/{self.other_deal.id}/offers/"
        self.other_deal.delete()
        self.assertEqual(self.post(deleted_url, self.payload).status_code, 404)
        self.assertEqual(
            self.post(
                self.note_url, {"body": "test", "deal": str(self.other_deal.id)}
            ).status_code,
            400,
        )
        unsafe = {
            **self.payload,
            "offers": [{**self.payload["offers"][0], "deal": str(self.other_deal.id)}],
        }
        self.assertEqual(self.post(self.offers_url, unsafe).status_code, 400)
        self.assertEqual(Note.objects.count(), 0)
        self.assertEqual(Quote.objects.count(), 0)

    def test_invalid_prices_url_period_and_offer_cap(self):
        variants = [
            {**self.payload, "offers": [{**self.payload["offers"][0], "premium": "0"}]},
            {
                **self.payload,
                "offers": [{**self.payload["offers"][0], "sum_insured": "-1"}],
            },
            {**self.payload, "calculation_url": "http://example.com/quote"},
            {**self.payload, "period_end": "2026-09-24"},
            {**self.payload, "offers": self.payload["offers"] * 16},
        ]
        for variant in variants:
            with self.subTest(variant=variant):
                self.assertEqual(self.post(self.offers_url, variant).status_code, 400)
        self.assertEqual(Quote.objects.count(), 0)
        self.assertEqual(InsuranceCompany.objects.count(), 0)

    def test_osago_allows_null_sum_but_life_requires_sum(self):
        osago = {
            **self.payload,
            "offers": [
                {
                    **self.payload["offers"][0],
                    "insurance_type": "ОСАГО",
                    "sum_insured": None,
                }
            ],
        }
        response = self.post(self.offers_url, osago)
        self.assertEqual(response.status_code, 201, response.data)
        self.assertIsNone(Quote.objects.get().sum_insured)
        _, read_token = CodexReadKey.issue("reader")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {read_token}")
        self.assertIsNone(
            self.client.get(
                f"/api/v1/codex/deals/{self.deal.id}/sections/quotes/"
            ).data["results"][0]["sum_insured"]
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token}")
        life = {
            **self.payload,
            "offers": [{**self.payload["offers"][0], "sum_insured": None}],
        }
        self.assertEqual(self.post(self.offers_url, life).status_code, 400)

    def test_transaction_rolls_back_if_note_creation_fails(self):
        with patch.object(Note, "save", side_effect=RuntimeError("storage failure")):
            with self.assertRaises(RuntimeError):
                self.post(self.offers_url, self.payload)
        self.assertEqual(Quote.objects.count(), 0)
        self.assertEqual(InsuranceCompany.objects.count(), 0)
        self.assertEqual(CodexWriteRequest.objects.count(), 0)

    def test_inactive_insurer_is_rejected_without_partial_write(self):
        company = InsuranceCompany.objects.create(name="РЕСО")
        company.delete()
        response = self.post(self.offers_url, self.payload)
        self.assertEqual(response.status_code, 400, response.data)
        self.assertEqual(Quote.objects.count(), 0)
        self.assertEqual(Note.objects.count(), 0)
        self.assertEqual(InsuranceCompany.objects.count(), 0)
