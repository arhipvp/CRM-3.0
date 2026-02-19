import importlib

from apps.clients.models import Client
from apps.common.tests.auth_utils import AuthenticatedAPITestCase
from apps.deals.models import Deal, InsuranceCompany, InsuranceType
from apps.policies.models import Policy
from django.apps import apps as django_apps
from django.contrib.auth.models import User
from django.db import connection
from rest_framework import status


class PolicyClientSourceOfTruthTests(AuthenticatedAPITestCase):
    def setUp(self):
        super().setUp()
        self.seller = User.objects.create_user(
            username="policy-seller", password="pass"
        )
        self.client_a = Client.objects.create(name="Client A")
        self.client_b = Client.objects.create(name="Client B")
        self.client_c = Client.objects.create(name="Client C")
        self.deal = Deal.objects.create(
            title="Deal",
            client=self.client_a,
            seller=self.seller,
            status="open",
            stage_name="initial",
        )
        self.insurance_company = InsuranceCompany.objects.create(name="Company")
        self.insurance_type = InsuranceType.objects.create(name="Type")
        self.token_for(self.seller)

    def _payload(self, **overrides):
        payload = {
            "number": "POL-SOURCE-001",
            "deal": str(self.deal.id),
            "insurance_company": str(self.insurance_company.id),
            "insurance_type": str(self.insurance_type.id),
        }
        payload.update(overrides)
        return payload

    def test_create_with_client_sets_client(self):
        self.authenticate(self.seller)
        response = self.api_client.post(
            "/api/v1/policies/",
            self._payload(client=str(self.client_b.id)),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created = Policy.objects.get(id=response.data["id"])
        self.assertEqual(created.client_id, self.client_b.id)

    def test_create_with_only_insured_client_maps_to_client(self):
        self.authenticate(self.seller)
        response = self.api_client.post(
            "/api/v1/policies/",
            self._payload(insured_client=str(self.client_b.id)),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created = Policy.objects.get(id=response.data["id"])
        self.assertEqual(created.client_id, self.client_b.id)

    def test_create_with_conflicting_client_and_insured_returns_400(self):
        self.authenticate(self.seller)
        response = self.api_client.post(
            "/api/v1/policies/",
            self._payload(
                client=str(self.client_b.id),
                insured_client=str(self.client_c.id),
            ),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("insured_client", response.data)

    def test_update_with_only_insured_client_maps_to_client(self):
        policy = Policy.objects.create(
            number="POL-SOURCE-UPDATE",
            deal=self.deal,
            insurance_company=self.insurance_company,
            insurance_type=self.insurance_type,
            client=self.client_a,
        )
        self.authenticate(self.seller)
        response = self.api_client.patch(
            f"/api/v1/policies/{policy.id}/",
            {"insured_client": str(self.client_b.id)},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        policy.refresh_from_db()
        self.assertEqual(policy.client_id, self.client_b.id)

    def test_migration_syncs_client_from_insured_for_conflicts(self):
        policy = Policy.objects.create(
            number="POL-MIGRATION-SYNC",
            deal=self.deal,
            insurance_company=self.insurance_company,
            insurance_type=self.insurance_type,
            client=self.client_a,
            insured_client=self.client_b,
        )
        self.assertEqual(policy.client_id, self.client_a.id)
        self.assertEqual(policy.insured_client_id, self.client_b.id)

        migration_module = importlib.import_module(
            "apps.policies.migrations.0015_sync_client_from_insured_legacy"
        )
        with connection.schema_editor() as schema_editor:
            migration_module.sync_client_from_insured(django_apps, schema_editor)

        policy.refresh_from_db()
        self.assertEqual(policy.client_id, self.client_b.id)
