import importlib

from apps.clients.models import Client
from apps.common.tests.auth_utils import AuthenticatedAPITestCase
from apps.deals.models import Deal, InsuranceCompany, InsuranceType, Quote
from django.contrib.auth.models import User
from rest_framework import status


class QuoteApiTests(AuthenticatedAPITestCase):
    def setUp(self):
        super().setUp()
        self.user = User.objects.create_user(username="quote_api", password="pass")
        self.authenticate(self.user)
        client = Client.objects.create(name="Quote API Client")
        self.deal = Deal.objects.create(
            title="Quote API Deal",
            client=client,
            seller=self.user,
            status="open",
            stage_name="initial",
        )
        self.insurance_company = InsuranceCompany.objects.create(
            name="Quote API Company"
        )
        self.insurance_type = InsuranceType.objects.create(name="КАСКО")

    def test_create_quote_accepts_numeric_deductible_and_returns_number(self):
        response = self.api_client.post(
            "/api/v1/quotes/",
            {
                "deal": str(self.deal.id),
                "insurance_company": str(self.insurance_company.id),
                "insurance_type": str(self.insurance_type.id),
                "sum_insured": 1000000,
                "premium": 50000,
                "deductible": 300000.5,
                "official_dealer": False,
                "gap": False,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["deductible"], 300000.5)
        self.assertEqual(float(Quote.objects.get().deductible), 300000.5)

    def test_update_quote_allows_empty_deductible(self):
        quote = Quote.objects.create(
            deal=self.deal,
            seller=self.user,
            insurance_company=self.insurance_company,
            insurance_type=self.insurance_type,
            sum_insured=1000000,
            premium=50000,
            deductible=150000,
        )

        response = self.api_client.patch(
            f"/api/v1/quotes/{quote.id}/",
            {
                "insurance_company": str(self.insurance_company.id),
                "insurance_type": str(self.insurance_type.id),
                "sum_insured": 1000000,
                "premium": 50000,
                "deductible": None,
                "official_dealer": False,
                "gap": False,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(response.data["deductible"])
        quote.refresh_from_db()
        self.assertIsNone(quote.deductible)


class QuoteDeductibleMigrationParsingTests(AuthenticatedAPITestCase):
    def test_parse_legacy_deductible_handles_supported_formats(self):
        migration = importlib.import_module(
            "apps.deals.migrations.0030_quote_deductible_decimal"
        )
        parse_legacy_deductible = migration.parse_legacy_deductible

        self.assertEqual(str(parse_legacy_deductible("300000")), "300000")
        self.assertEqual(str(parse_legacy_deductible("300 000")), "300000")
        self.assertEqual(str(parse_legacy_deductible("300000,50")), "300000.50")
        self.assertEqual(str(parse_legacy_deductible("300 000 ₽")), "300000")
        self.assertIsNone(parse_legacy_deductible(""))
        self.assertIsNone(parse_legacy_deductible("без франшизы"))
