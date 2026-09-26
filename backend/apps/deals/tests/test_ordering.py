from datetime import date, timedelta

from apps.clients.models import Client
from apps.common.tests.auth_utils import AuthenticatedAPITestCase
from apps.deals.models import Deal, DealPin
from django.contrib.auth.models import User
from django.utils import timezone


class DealOrderingTests(AuthenticatedAPITestCase):
    def setUp(self):
        super().setUp()
        self.seller = User.objects.create_user(
            username="seller-ordering", password="pass"  # pragma: allowlist secret
        )
        self.authenticate(self.seller)
        self.created_at_base = timezone.now()
        self.deal_sequence = 0

    def _deal(self, title, client, **dates):
        deal = Deal.objects.create(
            title=title,
            client=client,
            seller=self.seller,
            status=Deal.DealStatus.OPEN,
            **dates,
        )
        # Windows clock resolution may give consecutive inserts equal timestamps.
        # These tests exercise creation order, not the random UUID tie-breaker.
        self.deal_sequence += 1
        deal.created_at = self.created_at_base + timedelta(seconds=self.deal_sequence)
        Deal.objects.filter(pk=deal.pk).update(created_at=deal.created_at)
        return deal

    @staticmethod
    def _result_ids(response):
        return [item["id"] for item in response.data["results"]]

    def test_default_order_groups_same_client_after_next_contact_date(self):
        alpha = Client.objects.create(name="Альфа")
        beta = Client.objects.create(name="Бета")
        same_day = date(2026, 10, 1)
        alpha_first = self._deal(
            "Alpha first",
            alpha,
            next_contact_date=same_day,
            next_review_date=date(2026, 10, 2),
        )
        beta_deal = self._deal(
            "Beta",
            beta,
            next_contact_date=same_day,
            next_review_date=date(2026, 10, 10),
        )
        alpha_second = self._deal(
            "Alpha second",
            alpha,
            next_contact_date=same_day,
            next_review_date=date(2026, 10, 1),
        )

        response = self.api_client.get("/api/v1/deals/", format="json")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            self._result_ids(response),
            [str(alpha_first.id), str(alpha_second.id), str(beta_deal.id)],
        )

    def test_date_ordering_groups_clients_in_both_directions(self):
        alpha = Client.objects.create(name="Альфа")
        beta = Client.objects.create(name="Бета")
        same_day = date(2026, 10, 2)
        earlier = self._deal("Earlier", beta, next_contact_date=date(2026, 10, 1))
        alpha_first = self._deal("Alpha first", alpha, next_contact_date=same_day)
        beta_deal = self._deal("Beta", beta, next_contact_date=same_day)
        alpha_second = self._deal("Alpha second", alpha, next_contact_date=same_day)

        for ordering, expected_ids in (
            (
                "next_contact_date",
                [
                    str(earlier.id),
                    str(alpha_second.id),
                    str(alpha_first.id),
                    str(beta_deal.id),
                ],
            ),
            (
                "-next_contact_date",
                [
                    str(alpha_second.id),
                    str(alpha_first.id),
                    str(beta_deal.id),
                    str(earlier.id),
                ],
            ),
        ):
            with self.subTest(ordering=ordering):
                response = self.api_client.get(
                    "/api/v1/deals/", {"ordering": ordering}, format="json"
                )

                self.assertEqual(response.status_code, 200)
                self.assertEqual(self._result_ids(response), expected_ids)

    def test_deadline_ordering_groups_clients_in_both_directions(self):
        alpha = Client.objects.create(name="Альфа")
        beta = Client.objects.create(name="Бета")
        same_day = date(2026, 11, 2)
        earlier = self._deal("Earlier", beta, expected_close=date(2026, 11, 1))
        alpha_first = self._deal("Alpha first", alpha, expected_close=same_day)
        beta_deal = self._deal("Beta", beta, expected_close=same_day)
        alpha_second = self._deal("Alpha second", alpha, expected_close=same_day)

        for ordering, expected_ids in (
            (
                "expected_close",
                [
                    str(earlier.id),
                    str(alpha_second.id),
                    str(alpha_first.id),
                    str(beta_deal.id),
                ],
            ),
            (
                "-expected_close",
                [
                    str(alpha_second.id),
                    str(alpha_first.id),
                    str(beta_deal.id),
                    str(earlier.id),
                ],
            ),
        ):
            with self.subTest(ordering=ordering):
                response = self.api_client.get(
                    "/api/v1/deals/", {"ordering": ordering}, format="json"
                )

                self.assertEqual(response.status_code, 200)
                self.assertEqual(self._result_ids(response), expected_ids)

    def test_same_named_clients_are_separated_by_client_id(self):
        first_client = Client.objects.create(name="Одинаковый клиент")
        second_client = Client.objects.create(name=first_client.name)
        same_day = date(2026, 12, 1)
        first_client_first = self._deal(
            "First client first", first_client, next_contact_date=same_day
        )
        second_client_deal = self._deal(
            "Second client", second_client, next_contact_date=same_day
        )
        first_client_second = self._deal(
            "First client second", first_client, next_contact_date=same_day
        )

        response = self.api_client.get(
            "/api/v1/deals/", {"ordering": "next_contact_date"}, format="json"
        )

        result_ids = self._result_ids(response)
        first_positions = [
            result_ids.index(str(first_client_first.id)),
            result_ids.index(str(first_client_second.id)),
        ]
        second_position = result_ids.index(str(second_client_deal.id))
        self.assertEqual(abs(first_positions[0] - first_positions[1]), 1)
        self.assertNotIn(
            second_position, range(min(first_positions), max(first_positions) + 1)
        )

    def test_non_date_ordering_is_not_changed(self):
        alpha = Client.objects.create(name="Альфа")
        beta = Client.objects.create(name="Бета")
        beta_deal = self._deal("A title", beta, next_contact_date=date(2026, 10, 1))
        alpha_deal = self._deal("B title", alpha, next_contact_date=date(2026, 10, 1))

        response = self.api_client.get(
            "/api/v1/deals/", {"ordering": "title"}, format="json"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            self._result_ids(response), [str(beta_deal.id), str(alpha_deal.id)]
        )

    def test_pinned_deals_keep_pin_order_when_date_sorting_is_requested(self):
        alpha = Client.objects.create(name="Альфа")
        beta = Client.objects.create(name="Бета")
        pinned_first = self._deal(
            "Pinned first", beta, next_contact_date=date(2026, 10, 1)
        )
        pinned_second = self._deal(
            "Pinned second", alpha, next_contact_date=date(2026, 10, 1)
        )
        DealPin.objects.create(user=self.seller, deal=pinned_first)
        DealPin.objects.create(user=self.seller, deal=pinned_second)
        now = timezone.now()
        DealPin.objects.filter(user=self.seller, deal=pinned_first).update(
            created_at=now - timedelta(minutes=1)
        )

        response = self.api_client.get(
            "/api/v1/deals/", {"ordering": "next_contact_date"}, format="json"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            self._result_ids(response)[:2],
            [str(pinned_first.id), str(pinned_second.id)],
        )
