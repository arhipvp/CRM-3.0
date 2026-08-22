from io import BytesIO
from tempfile import TemporaryDirectory

from apps.clients.models import Client
from apps.deals.models import Deal, InsuranceCompany, InsuranceType, Quote
from apps.deals.serializers import InsuranceCompanySerializer, QuoteSerializer
from apps.policies.models import Policy
from apps.policies.serializers import PolicySerializer
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from PIL import Image
from rest_framework.test import APIRequestFactory


def make_png_upload(name: str = "logo.png", **kwargs) -> SimpleUploadedFile:
    content = BytesIO()
    Image.new("RGB", (1, 1), color="white").save(content, format="PNG")
    content_type = kwargs.pop("content_type", "image/png")
    return SimpleUploadedFile(
        name, content.getvalue(), content_type=content_type, **kwargs
    )


class InsuranceCompanyLogoValidationTests(TestCase):
    def test_accepts_valid_png_logo(self):
        company = InsuranceCompany(name="Valid Logo", logo=make_png_upload())

        company.full_clean()

    def test_rejects_unsupported_extension(self):
        company = InsuranceCompany(
            name="Invalid Extension",
            logo=SimpleUploadedFile("logo.jpg", b"image", content_type="image/jpeg"),
        )

        with self.assertRaisesMessage(ValidationError, "PNG, WebP или SVG"):
            company.full_clean()

    def test_rejects_mismatched_mime_type(self):
        company = InsuranceCompany(
            name="Mismatched MIME",
            logo=make_png_upload(content_type="image/webp"),
        )

        with self.assertRaisesMessage(ValidationError, "MIME-тип"):
            company.full_clean()

    def test_rejects_logo_larger_than_two_megabytes(self):
        company = InsuranceCompany(
            name="Oversized Logo",
            logo=SimpleUploadedFile(
                "logo.svg",
                b"x" * (2 * 1024 * 1024 + 1),
                content_type="image/svg+xml",
            ),
        )

        with self.assertRaisesMessage(ValidationError, "не должен превышать 2 МБ"):
            company.full_clean()

    def test_rejects_svg_with_doctype(self):
        company = InsuranceCompany(
            name="Unsafe SVG",
            logo=SimpleUploadedFile(
                "logo.svg",
                b'<!DOCTYPE svg><svg xmlns="http://www.w3.org/2000/svg" />',
                content_type="image/svg+xml",
            ),
        )

        with self.assertRaisesMessage(ValidationError, "DOCTYPE или ENTITY"):
            company.full_clean()


@override_settings(MEDIA_URL="/media/")
class InsuranceCompanySerializerTests(TestCase):
    def setUp(self):
        self.request = APIRequestFactory().get("/api/v1/insurance_companies/")

    def test_serializes_null_logo_url_when_logo_is_missing(self):
        company = InsuranceCompany.objects.create(name="Without Logo")

        data = InsuranceCompanySerializer(
            company, context={"request": self.request}
        ).data

        self.assertIsNone(data["logo_url"])

    def test_serializes_logo_url(self):
        company = InsuranceCompany.objects.create(
            name="With Logo", logo=make_png_upload()
        )

        data = InsuranceCompanySerializer(
            company, context={"request": self.request}
        ).data

        self.assertEqual(
            data["logo_url"], self.request.build_absolute_uri(company.logo.url)
        )

    def test_policy_serializer_includes_insurance_company_logo_url(self):
        client = Client.objects.create(name="Logo Client")
        company = InsuranceCompany.objects.create(
            name="Policy Logo", logo=make_png_upload()
        )
        policy = Policy.objects.create(
            number="LOGO-001",
            deal=Deal.objects.create(title="Logo Deal", client=client),
            client=client,
            insurance_company=company,
            insurance_type=InsuranceType.objects.create(name="Logo Type"),
        )

        data = PolicySerializer(policy, context={"request": self.request}).data

        self.assertEqual(
            data["insurance_company_logo_url"],
            self.request.build_absolute_uri(company.logo.url),
        )

    def test_quote_serializer_includes_insurance_company_logo_url(self):
        client = Client.objects.create(name="Quote Logo Client")
        company = InsuranceCompany.objects.create(
            name="Quote Logo", logo=make_png_upload()
        )
        quote = Quote.objects.create(
            deal=Deal.objects.create(title="Quote Logo Deal", client=client),
            insurance_company=company,
            insurance_type=InsuranceType.objects.create(name="Quote Logo Type"),
            sum_insured=1000000,
            premium=50000,
        )

        data = QuoteSerializer(quote, context={"request": self.request}).data

        self.assertEqual(
            data["insurance_company_logo_url"],
            self.request.build_absolute_uri(company.logo.url),
        )

    def test_sanitizes_executable_and_external_svg_content_before_storage(self):
        svg = b"""<svg xmlns="http://www.w3.org/2000/svg">
            <script>alert(1)</script>
            <path onclick="alert(1)" fill="url(https://example.test/pattern)" />
            <use href="https://example.test/logo.svg" />
        </svg>"""
        with TemporaryDirectory() as media_root, override_settings(
            MEDIA_ROOT=media_root
        ):
            company = InsuranceCompany.objects.create(
                name="Sanitized SVG",
                logo=SimpleUploadedFile("logo.svg", svg, content_type="image/svg+xml"),
            )
            company.logo.open()
            stored_svg = company.logo.read().decode("utf-8")
            company.logo.close()

        self.assertNotIn("script", stored_svg)
        self.assertNotIn("onclick", stored_svg)
        self.assertNotIn("example.test", stored_svg)
