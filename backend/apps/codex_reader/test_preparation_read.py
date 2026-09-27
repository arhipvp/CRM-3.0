from unittest.mock import patch

from apps.clients.models import Client
from apps.deals.models import Bank, InsuranceCompany, InsuranceType
from apps.insurance_requests.models import ClientPassport, LeasingCompany, Platform
from rest_framework.test import APITestCase

from .models import CodexReadKey, CodexWriteKey


class PreparationReadTests(APITestCase):
    def setUp(self):
        mocked = patch("apps.clients.signals.ensure_client_folder")
        mocked.start()
        self.addCleanup(mocked.stop)
        self.key, token = CodexReadKey.issue("test read")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        self.person = Client.objects.create(name="Тестовый человек")
        self.url = "/api/v1/codex/clients/"

    def test_search_and_details_exclude_deleted_and_scope_documents(self):
        other = Client.objects.create(name="Тестовый другой")
        deleted = Client.objects.create(name="Тестовый удалённый")
        deleted.delete()
        passport = ClientPassport.objects.create(client=self.person, number="123")
        ClientPassport.objects.create(client=other, number="456")
        response = self.client.get(self.url, {"q": "Тестовый", "page_size": 1})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 2)
        self.assertIsNotNone(response.data["next"])
        response = self.client.get(self.url, {"q": str(self.person.pk)})
        self.assertEqual(response.data["results"][0]["id"], str(self.person.pk))
        response = self.client.get(f"{self.url}{self.person.pk}/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [doc["id"] for doc in response.data["passports"]], [str(passport.pk)]
        )
        self.assertEqual(self.client.get(f"{self.url}{deleted.pk}/").status_code, 404)
        self.assertEqual(self.client.get(self.url).status_code, 400)

    def test_reference_types_paginate_and_filter_unavailable(self):
        for kind, model in (
            ("insurance_companies", InsuranceCompany),
            ("insurance_types", InsuranceType),
            ("banks", Bank),
            ("platforms", Platform),
            ("leasing_companies", LeasingCompany),
        ):
            kept = model.objects.create(name="Тест")
            deleted = model.objects.create(name="Тест удалён")
            deleted.delete()
            if model in {Platform, LeasingCompany}:
                model.objects.create(name="Тест старый", is_current=False)
            response = self.client.get(
                "/api/v1/codex/references/", {"kind": kind, "q": "Тест"}
            )
            self.assertEqual(response.status_code, 200)
            self.assertEqual(
                response.data["results"], [{"id": str(kept.pk), "name": kept.name}]
            )
        self.assertEqual(
            self.client.get("/api/v1/codex/references/", {"kind": "users"}).status_code,
            400,
        )

    def test_key_boundaries_and_revocation(self):
        self.assertEqual(self.client.post(self.url, {}).status_code, 405)
        self.key.revoke()
        self.assertEqual(self.client.get(self.url, {"q": "Тест"}).status_code, 403)
        _, token = CodexWriteKey.issue("test write")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        self.assertEqual(self.client.get(self.url, {"q": "Тест"}).status_code, 403)
