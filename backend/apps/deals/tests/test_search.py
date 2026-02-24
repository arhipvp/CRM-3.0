from apps.clients.models import Client
from apps.common.tests.auth_utils import AuthenticatedAPITestCase
from apps.deals.models import Deal
from django.contrib.auth.models import User
from rest_framework import status


class DealSearchByIdTests(AuthenticatedAPITestCase):
    def setUp(self):
        super().setUp()
        self.seller = User.objects.create_user(
            username="seller-search", password="pass"  # pragma: allowlist secret
        )
        self.client_obj = Client.objects.create(
            name="Иван Иванов",
            phone="+7 (900) 000-00-01",
        )
        self.target_deal = Deal.objects.create(
            title="Ипотека",
            description="Заявка по ипотеке",
            client=self.client_obj,
            seller=self.seller,
            status="open",
            stage_name="initial",
        )
        self.other_deal = Deal.objects.create(
            title="КАСКО",
            description="Автострахование",
            client=self.client_obj,
            seller=self.seller,
            status="open",
            stage_name="initial",
        )
        self.authenticate(self.seller)

    @staticmethod
    def _extract_ids(response):
        payload = response.data if isinstance(response.data, dict) else {}
        results = payload.get("results", payload if isinstance(payload, list) else [])
        return [str(item["id"]) for item in results]

    def test_search_finds_deal_by_full_uuid(self):
        response = self.api_client.get(
            "/api/v1/deals/",
            {"search": str(self.target_deal.id)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        deal_ids = self._extract_ids(response)
        self.assertIn(str(self.target_deal.id), deal_ids)
        self.assertNotIn(str(self.other_deal.id), deal_ids)

    def test_search_finds_deal_by_short_uuid_prefix(self):
        response = self.api_client.get(
            "/api/v1/deals/",
            {"search": str(self.target_deal.id)[:8]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        deal_ids = self._extract_ids(response)
        self.assertIn(str(self.target_deal.id), deal_ids)
        self.assertNotIn(str(self.other_deal.id), deal_ids)

    def test_search_finds_deal_by_hash_prefixed_short_uuid(self):
        response = self.api_client.get(
            "/api/v1/deals/",
            {"search": f"#{str(self.target_deal.id)[:8]}"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        deal_ids = self._extract_ids(response)
        self.assertIn(str(self.target_deal.id), deal_ids)
        self.assertNotIn(str(self.other_deal.id), deal_ids)

    def test_search_does_not_return_matches_for_irrelevant_query(self):
        response = self.api_client.get(
            "/api/v1/deals/",
            {"search": "not-existing-query"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(self._extract_ids(response), [])

    def test_search_keeps_existing_title_and_client_search(self):
        response_by_title = self.api_client.get(
            "/api/v1/deals/",
            {"search": "Ипотека"},
            format="json",
        )
        response_by_client = self.api_client.get(
            "/api/v1/deals/",
            {"search": "Иванов"},
            format="json",
        )

        self.assertEqual(response_by_title.status_code, status.HTTP_200_OK)
        self.assertEqual(response_by_client.status_code, status.HTTP_200_OK)
        self.assertIn(str(self.target_deal.id), self._extract_ids(response_by_title))
        self.assertIn(str(self.target_deal.id), self._extract_ids(response_by_client))
