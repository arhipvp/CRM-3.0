from datetime import timedelta

from apps.clients.models import Client
from apps.common.tests.auth_utils import AuthenticatedAPITestCase
from apps.deals.models import Deal, DealPin
from django.contrib.auth.models import User
from django.utils import timezone
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
        self.assertEqual(first_response.data["count"], 65)
        self.assertEqual(second_response.data["count"], 65)
        self.assertEqual(len(second_ids), 20)
        self.assertTrue(set(second_ids).isdisjoint(first_ids))
        self.assertTrue(
            set(second_ids).isdisjoint({str(deal.id) for deal in pinned_deals})
        )

    def test_search_only_includes_matching_pinned_deals(self):
        matching_pinned, unrelated_pinned, matching_regular = self._create_deals(3)
        matching_pinned.title = "Needle pinned deal"
        matching_pinned.save(update_fields=["title"])
        unrelated_pinned.title = "Unrelated pinned deal"
        unrelated_pinned.save(update_fields=["title"])
        matching_regular.title = "Needle regular deal"
        matching_regular.save(update_fields=["title"])
        DealPin.objects.bulk_create(
            [
                DealPin(user=self.seller, deal=matching_pinned),
                DealPin(user=self.seller, deal=unrelated_pinned),
            ]
        )

        response = self.api_client.get(
            "/api/v1/deals/",
            {"page": 1, "page_size": 20, "search": "Needle"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        result_ids = self._result_ids(response)
        self.assertEqual(result_ids[0], str(matching_pinned.id))
        self.assertEqual(
            set(result_ids),
            {str(matching_pinned.id), str(matching_regular.id)},
        )
        self.assertEqual(response.data["count"], 2)

    def test_search_without_matches_excludes_pinned_deals_from_count(self):
        pinned_deal = self._create_deals(1)[0]
        DealPin.objects.create(user=self.seller, deal=pinned_deal)

        response = self.api_client.get(
            "/api/v1/deals/",
            {"page": 1, "page_size": 20, "search": "missing search value"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["results"], [])
        self.assertEqual(response.data["count"], 0)

    def test_pinned_deals_are_ordered_by_first_pin(self):
        oldest, middle, newest = self._create_deals(3)
        pins = [
            DealPin.objects.create(user=self.seller, deal=oldest),
            DealPin.objects.create(user=self.seller, deal=middle),
            DealPin.objects.create(user=self.seller, deal=newest),
        ]
        now = timezone.now()
        for pin, created_at in zip(
            pins,
            [now - timedelta(minutes=2), now - timedelta(minutes=1), now],
        ):
            DealPin.objects.filter(pk=pin.pk).update(created_at=created_at)

        response = self.api_client.get(
            "/api/v1/deals/",
            {"page": 1, "page_size": 20, "ordering": "-created_at"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            self._result_ids(response)[:3],
            [str(oldest.id), str(middle.id), str(newest.id)],
        )

    def test_pinned_deals_respect_non_search_filters(self):
        other_client = Client.objects.create(name="Other Pinning Client")
        other_executor = User.objects.create_user(
            username="other-executor", password="pass"  # pragma: allowlist secret
        )
        matching = self._create_deals(1)[0]
        other_client_deal = Deal.objects.create(
            title="Other client pinned",
            client=other_client,
            seller=self.seller,
            executor=other_executor,
        )
        closed = Deal.objects.create(
            title="Closed pinned",
            client=self.client_record,
            seller=self.seller,
            status=Deal.DealStatus.WON,
        )
        deleted = Deal.objects.create(
            title="Deleted pinned",
            client=self.client_record,
            seller=self.seller,
        )
        deleted.delete()
        DealPin.objects.bulk_create(
            [
                DealPin(user=self.seller, deal=matching),
                DealPin(user=self.seller, deal=other_client_deal),
                DealPin(user=self.seller, deal=closed),
                DealPin(user=self.seller, deal=deleted),
            ]
        )

        default_response = self.api_client.get("/api/v1/deals/", format="json")
        client_response = self.api_client.get(
            "/api/v1/deals/", {"client": other_client.id}, format="json"
        )
        executor_response = self.api_client.get(
            "/api/v1/deals/", {"executor": other_executor.id}, format="json"
        )
        closed_response = self.api_client.get(
            "/api/v1/deals/",
            {"status": Deal.DealStatus.WON, "show_closed": "1"},
            format="json",
        )
        deleted_response = self.api_client.get(
            "/api/v1/deals/", {"show_deleted": "1"}, format="json"
        )

        self.assertEqual(
            set(self._result_ids(default_response)),
            {str(matching.id), str(other_client_deal.id)},
        )
        self.assertEqual(self._result_ids(client_response), [str(other_client_deal.id)])
        self.assertEqual(
            self._result_ids(executor_response), [str(other_client_deal.id)]
        )
        self.assertEqual(self._result_ids(closed_response), [str(closed.id)])
        self.assertEqual(
            set(self._result_ids(deleted_response)),
            {str(matching.id), str(other_client_deal.id), str(deleted.id)},
        )

    def test_unpinned_deal_returns_to_regular_first_page(self):
        deal = self._create_deals(20)[0]
        DealPin.objects.create(user=self.seller, deal=deal)

        pinned_response = self.api_client.get(
            "/api/v1/deals/", {"page": 1, "page_size": 20}, format="json"
        )
        unpin_response = self.api_client.post(
            f"/api/v1/deals/{deal.id}/unpin/", format="json"
        )
        regular_response = self.api_client.get(
            "/api/v1/deals/", {"page": 1, "page_size": 20}, format="json"
        )

        self.assertEqual(pinned_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(self._result_ids(pinned_response)), 20)
        self.assertEqual(unpin_response.status_code, status.HTTP_200_OK)
        self.assertFalse(unpin_response.data["is_pinned"])
        self.assertEqual(regular_response.status_code, status.HTTP_200_OK)
        self.assertEqual(regular_response.data["count"], 20)
        self.assertEqual(len(self._result_ids(regular_response)), 20)
        self.assertIn(str(deal.id), self._result_ids(regular_response))
