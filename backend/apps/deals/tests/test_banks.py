from apps.common.tests.auth_utils import AuthenticatedAPITestCase
from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status


class BankCatalogApiTests(AuthenticatedAPITestCase):
    def setUp(self):
        super().setUp()
        self.user = User.objects.create_user(username="bank-catalog-user")

    def test_lists_seeded_banks_with_logos_through_read_only_endpoint(self):
        self.authenticate(self.user)

        response = self.api_client.get(reverse("bank-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        banks_by_name = {item["name"]: item for item in response.json()}
        self.assertTrue({"Сбер", "ВТБ", "Альфа"}.issubset(banks_by_name))
        for name in ("Сбер", "ВТБ", "Альфа"):
            self.assertIsNotNone(banks_by_name[name]["logo_url"])

    def test_write_is_not_allowed(self):
        self.authenticate(self.user)

        response = self.api_client.post(reverse("bank-list"), {"name": "Новый"})

        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
