from apps.clients.models import Client
from apps.common.tests.auth_utils import AuthenticatedAPITestCase
from apps.deals.models import Deal, DealPin
from django.contrib.auth.models import User
from rest_framework import status


class DealPinningTests(AuthenticatedAPITestCase):
    def setUp(self):
        super().setUp()
        self.seller = User.objects.create_user(
            username="seller-pinning", password="pass"  # pragma: allowlist secret
        )
        self.client_record = Client.objects.create(name="Pinning Client")
        self.authenticate(self.seller)

    def _create_deals(self, count):
        return [
            Deal.objects.create(
                title=f"Pinning Deal {index}",
                client=self.client_record,
                seller=self.seller,
                status=Deal.DealStatus.OPEN,
            )
            for index in range(count)
        ]

    @staticmethod
    def _result_ids(response):
        return [str(item["id"]) for item in response.data["results"]]

    def test_can_pin_more_than_five_deals(self):
        deals = self._create_deals(6)

        for deal in deals:
            response = self.api_client.post(
                f"/api/v1/deals/{deal.id}/pin/", format="json"
            )
            self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.assertEqual(DealPin.objects.filter(user=self.seller).count(), 6)

    def test_first_page_contains_pins_and_twenty_other_deals(self):
        deals = self._create_deals(65)
        pinned_deals = deals[:25]
        DealPin.objects.bulk_create(
            [DealPin(user=self.seller, deal=deal) for deal in pinned_deals]
        )

        response = self.api_client.get(
            "/api/v1/deals/", {"page": 1, "page_size": 20}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        result_ids = self._result_ids(response)
        pinned_ids = {str(deal.id) for deal in pinned_deals}
        self.assertEqual(len(result_ids), 45)
        self.assertTrue(pinned_ids.issubset(result_ids))
        self.assertEqual(
            len(set(result_ids) - pinned_ids),
            20,
        )
        self.assertEqual(len(result_ids), len(set(result_ids)))

    def test_second_page_contains_next_regular_deals_without_pins(self):
        deals = self._create_deals(65)
        pinned_deals = deals[:25]
        DealPin.objects.bulk_create(
            [DealPin(user=self.seller, deal=deal) for deal in pinned_deals]
        )

        first_response = self.api_client.get(
            "/api/v1/deals/", {"page": 1, "page_size": 20}, format="json"
        )
        second_response = self.api_client.get(
            "/api/v1/deals/", {"page": 2, "page_size": 20}, format="json"
        )

        self.assertEqual(first_response.status_code, status.HTTP_200_OK)
        self.assertEqual(second_response.status_code, status.HTTP_200_OK)
        first_ids = set(self._result_ids(first_response))
        second_ids = self._result_ids(second_response)
        self.assertEqual(len(second_ids), 20)
        self.assertTrue(set(second_ids).isdisjoint(first_ids))
        self.assertTrue(
            set(second_ids).isdisjoint({str(deal.id) for deal in pinned_deals})
        )
