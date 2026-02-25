from apps.clients.models import Client
from apps.common.tests.auth_utils import AuthenticatedAPITestCase
from apps.deals.models import Deal, InsuranceCompany, InsuranceType, Quote
from apps.policies.models import Policy
from apps.users.models import Role, UserRole
from django.contrib.auth.models import User
from rest_framework import status


class DealEmbedTests(AuthenticatedAPITestCase):
    def setUp(self):
        super().setUp()
        self.admin = User.objects.create_user(username="admin_embed", password="pass")
        admin_role, _ = Role.objects.get_or_create(name="Admin")
        UserRole.objects.create(user=self.admin, role=admin_role)
        self.token_for(self.admin)
        self.authenticate(self.admin)

        self.client_record = Client.objects.create(name="Embed Client")
        self.deal = Deal.objects.create(
            title="Embed Deal",
            client=self.client_record,
            seller=self.admin,
            status=Deal.DealStatus.OPEN,
            stage_name="initial",
        )
        company = InsuranceCompany.objects.create(name="Embed Insurance Co")
        insurance_type = InsuranceType.objects.create(name="КАСКО")
        Quote.objects.create(
            deal=self.deal,
            insurance_company=company,
            insurance_type=insurance_type,
            sum_insured=100000,
            premium=1000,
            official_dealer=False,
            gap=False,
        )
        Policy.objects.create(deal=self.deal, number="EMB-001")

    def _first_result(self, response):
        data = response.data
        if isinstance(data, dict):
            results = data.get("results", [])
            return results[0] if results else {}
        return data[0] if data else {}

    def test_embed_none_excludes_nested_fields(self):
        response = self.api_client.get(
            "/api/v1/deals/",
            {"show_closed": "1", "embed": "none"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        row = self._first_result(response)
        self.assertNotIn("quotes", row)
        self.assertNotIn("documents", row)
        self.assertNotIn("policies", row)

    def test_embed_quotes_includes_only_quotes_from_nested_fields(self):
        response = self.api_client.get(
            "/api/v1/deals/",
            {"show_closed": "1", "embed": "quotes"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        row = self._first_result(response)
        self.assertIn("quotes", row)
        self.assertNotIn("documents", row)
        self.assertNotIn("policies", row)
        self.assertEqual(len(row["quotes"]), 1)

    def test_default_contract_remains_backward_compatible(self):
        response = self.api_client.get(
            "/api/v1/deals/",
            {"show_closed": "1"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        row = self._first_result(response)
        self.assertIn("quotes", row)
        self.assertIn("documents", row)
        self.assertIn("policies", row)
