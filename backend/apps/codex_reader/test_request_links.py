import uuid
from copy import deepcopy
from unittest.mock import patch

from apps.clients.models import Client
from apps.deals.models import Deal, InsuranceCompany, InsuranceType, Quote
from apps.deals.serializers import QuoteSerializer
from apps.insurance_requests.models import (
    ClientPassport,
    DealParticipant,
    InsuranceRequest,
    Platform,
    RequestVariant,
    RequestVersion,
    Vehicle,
)
from apps.insurance_requests.services import request_snapshot
from apps.policies.models import Policy
from apps.policies.serializers import PolicySerializer
from rest_framework.test import APITestCase

from .models import CodexReadKey, CodexWriteKey


class RequestLinksTests(APITestCase):
    def setUp(self):
        for target in (
            "apps.clients.signals.ensure_client_folder",
            "apps.deals.signals.ensure_deal_folder",
            "apps.policies.signals.ensure_policy_folder",
        ):
            mocked = patch(target, return_value=None)
            mocked.start()
            self.addCleanup(mocked.stop)
        person = Client.objects.create(name="Тестовый страхователь")
        self.person = person
        self.deal = Deal.objects.create(title="Тестовая сделка", client=person)
        self.other = Deal.objects.create(title="Другая", client=person)
        DealParticipant.objects.get_or_create(deal=self.deal, client=person)
        self.company = InsuranceCompany.objects.create(name="РЕСО-тест")
        self.kind = InsuranceType.objects.create(name="КАСКО")
        self.platform = Platform.objects.create(name="RESO-test")
        vehicle = Vehicle.objects.create(deal=self.deal, title="Машина")
        self.application = InsuranceRequest.objects.create(
            deal=self.deal,
            title="КАСКО",
            vehicle=vehicle,
            insurance_type=self.kind,
            policyholder=person,
            start_date="2026-09-26",
            end_date="2027-09-25",
            version=1,
            official_dealer=True,
            vehicle_value_mode="maximum",
        )
        self.application.refresh_from_db()
        self.version = RequestVersion.objects.create(
            insurance_request=self.application,
            number=1,
            snapshot=request_snapshot(self.application),
        )
        self.variant = RequestVariant.objects.create(
            insurance_request=self.application,
            request_version=self.version,
            insurance_company=self.company,
            platform=self.platform,
            deductible="0.00",
        )
        _, self.write_token = CodexWriteKey.issue("test")
        self.read_key, self.read_token = CodexReadKey.issue("test")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.write_token}")
        self.url = f"/api/v1/codex/write/deals/{self.deal.pk}/offers/"
        self.payload = {
            "platform": self.platform.name,
            "calculation_url": "https://example.com/quote",
            "period_start": "2026-09-26",
            "period_end": "2027-09-25",
            "note": "Тест",
            "offers": [
                {
                    "insurance_company": self.company.name,
                    "insurance_type": self.kind.name,
                    "premium": "10000.00",
                    "sum_insured": "1000000.00",
                    "official_dealer": True,
                    "deductible": "0.00",
                    "status": "preliminary",
                    "request_variant": str(self.variant.pk),
                    "request_version": self.version.pk,
                }
            ],
        }

    def post_offer(self, payload=None, key=None, url=None):
        return self.client.post(
            url or self.url,
            payload or self.payload,
            format="json",
            HTTP_IDEMPOTENCY_KEY=str(key or uuid.uuid4()),
        )

    def test_create_links_and_replay_after_close(self):
        key = uuid.uuid4()
        first = self.post_offer(key=key)
        self.assertEqual(first.status_code, 201, first.data)
        quote = Quote.objects.get(pk=first.data["quote_ids"][0])
        self.assertEqual(quote.request_variant_id, self.variant.pk)
        self.assertEqual(quote.request_version_id, self.version.pk)
        self.assertEqual(quote.insurance_request_id, self.application.pk)
        self.variant.refresh_from_db()
        self.assertEqual(self.variant.status, "quoted")
        self.application.is_current = False
        self.application.save()
        replay = self.post_offer(key=key)
        self.assertEqual(replay.status_code, 200, replay.data)
        self.assertEqual(first.data["quote_ids"], replay.data["quote_ids"])
        self.assertEqual(self.post_offer().status_code, 400)
        self.assertEqual(Quote.objects.count(), 1)

    def test_reject_mismatched_deal_conditions_and_version(self):
        foreign_url = f"/api/v1/codex/write/deals/{self.other.pk}/offers/"
        self.assertEqual(self.post_offer(url=foreign_url).status_code, 400)
        for field, value in (
            ("request_version", self.version.pk + 10),
            ("insurance_company", "Чужая СК"),
            ("deductible", "5000.00"),
            ("official_dealer", False),
        ):
            payload = deepcopy(self.payload)
            payload["offers"][0][field] = value
            response = self.post_offer(payload)
            self.assertEqual(response.status_code, 400, (field, response.data))
        for field, value in (
            ("platform", "Чужая платформа"),
            ("period_start", "2026-09-27"),
        ):
            payload = {**self.payload, field: value}
            self.assertEqual(self.post_offer(payload).status_code, 400)
        self.assertEqual(Quote.objects.count(), 0)

    def test_fixed_sum_is_checked(self):
        self.application.vehicle_value_mode = "fixed"
        self.application.vehicle_value = "2000000.00"
        self.application.save()
        self.version.snapshot.update(
            vehicle_value_mode="fixed", vehicle_value="2000000.00"
        )
        self.version.save()
        response = self.post_offer()
        self.assertEqual(response.status_code, 400)
        self.assertIn("sum_insured", response.data)

    def test_source_change_requires_refreshed_snapshot(self):
        self.person.birth_place = "Новое место"
        self.person.save()
        rejected = self.post_offer()
        self.assertEqual(rejected.status_code, 400, rejected.data)
        self.assertIn("request_version", rejected.data)
        self.version.snapshot = request_snapshot(self.application)
        self.version.save()
        self.assertEqual(self.post_offer().status_code, 201)

    def test_batch_failure_is_atomic_and_maximum_preserves_actual_amounts(self):
        payload = deepcopy(self.payload)
        second = {**payload["offers"][0], "deductible": "999.00"}
        payload["offers"].append(second)
        self.assertEqual(self.post_offer(payload).status_code, 400)
        self.assertEqual(Quote.objects.count(), 0)
        self.variant.refresh_from_db()
        self.assertEqual(self.variant.status, "pending")
        payload["offers"][1]["deductible"] = "0.00"
        payload["offers"][1]["sum_insured"] = "1500000.00"
        result = self.post_offer(payload)
        self.assertEqual(result.status_code, 201, result.data)
        self.assertEqual(
            {
                str(value)
                for value in Quote.objects.values_list("sum_insured", flat=True)
            },
            {"1000000.00", "1500000.00"},
        )

    def test_old_version_is_rejected(self):
        self.application.version = 2
        self.application.save()
        self.assertEqual(self.post_offer().status_code, 400)

    def test_partial_link_and_deleted_request(self):
        payload = deepcopy(self.payload)
        payload["offers"][0].pop("request_version")
        self.assertEqual(self.post_offer(payload).status_code, 400)
        self.application.delete()
        self.assertEqual(self.post_offer().status_code, 400)

    def test_reader_isolation_and_unchanged_snapshot(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.read_token}")
        ClientPassport.objects.create(client=self.person, number="123456")
        url = f"/api/v1/codex/deals/{self.deal.pk}/requests/{self.application.pk}/passport/"
        old_snapshot = deepcopy(self.version.snapshot)
        self.person.name = "Новое имя"
        self.person.save()
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["snapshot"], old_snapshot)
        self.assertEqual(
            self.client.get(
                url.replace(str(self.deal.pk), str(self.other.pk))
            ).status_code,
            404,
        )
        self.assertEqual(self.client.get(url + "?version=999999").status_code, 404)
        data = self.client.get(f"/api/v1/codex/deals/{self.deal.pk}/data/")
        self.assertEqual(data.status_code, 200, data.data)
        self.assertEqual(len(data.data["passports"]), 1)
        self.assertEqual(self.client.post(url, {}, format="json").status_code, 405)
        self.read_key.revoke()
        self.assertEqual(self.client.get(url).status_code, 403)

    def test_regular_quote_and_policy_reject_foreign_request(self):
        quote = QuoteSerializer(
            data={
                "deal": str(self.other.pk),
                "insurance_company": str(self.company.pk),
                "insurance_type": str(self.kind.pk),
                "premium": "10000",
                "request_variant": str(self.variant.pk),
                "deductible": "0",
                "official_dealer": True,
            }
        )
        self.assertFalse(quote.is_valid())
        self.assertIn("insurance_request", quote.errors)
        policy = Policy(deal=self.other, number="TEST", client=self.person)
        serializer = PolicySerializer(
            policy, data={"insurance_request": str(self.application.pk)}, partial=True
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn("insurance_request", serializer.errors)
