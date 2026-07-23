from unittest.mock import patch

from apps.clients.models import Client
from apps.common.tests.auth_utils import AuthenticatedAPITestCase
from apps.deals.models import Deal
from django.contrib.auth.models import User
from rest_framework import status


class DealCalculationRecognitionTests(AuthenticatedAPITestCase):
    def setUp(self):
        super().setUp()
        self.seller = User.objects.create_user(
            username="seller-calculation", password="pass"  # pragma: allowlist secret
        )
        self.other_user = User.objects.create_user(
            username="other-calculation", password="pass"  # pragma: allowlist secret
        )
        client = Client.objects.create(name="Calculation client")
        self.deal = Deal.objects.create(
            title="Calculation deal", client=client, seller=self.seller
        )
        self.token_for(self.seller)
        self.token_for(self.other_user)

    def test_recognize_text_source_returns_normalized_osago_data(self):
        self.authenticate(self.seller)
        with patch(
            "apps.deals.calculation_recognition.recognize_policy_from_text",
            return_value=(
                {
                    "client_name": "ИВАНОВ ИВАН ИВАНОВИЧ",
                    "policy": {
                        "start_date": "2026-01-01",
                        "vehicle_brand": "Lada",
                        "vehicle_model": "Vesta",
                        "vehicle_vin": "XTA12345678901234",
                    },
                },
                "transcript",
            ),
        ):
            response = self.api_client.post(
                f"/api/v1/deals/{self.deal.id}/recognize-calculation/",
                {
                    "calculation_type": "osago",
                    "source_text": "Данные клиента и автомобиля",
                },
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data["data"]["policyholder"]["full_name"],
            "ИВАНОВ ИВАН ИВАНОВИЧ",
        )
        self.assertEqual(response.data["data"]["vehicle"]["brand"], "Lada")
        self.assertEqual(response.data["data"]["insurance"]["start_date"], "2026-01-01")

    def test_recognize_file_and_text_merges_sources_and_reports_conflict(self):
        self.authenticate(self.seller)
        Deal.objects.filter(pk=self.deal.pk).update(drive_folder_id="deal-folder")
        with (
            patch(
                "apps.deals.calculation_recognition.build_drive_file_tree_map",
                return_value={
                    "sts-file": {
                        "id": "sts-file",
                        "name": "sts.jpg",
                        "is_folder": False,
                    }
                },
            ),
            patch(
                "apps.deals.calculation_recognition.download_drive_file",
                return_value=b"image",
            ),
            patch(
                "apps.deals.calculation_recognition.recognize_document_from_file"
            ) as recognize_file,
            patch(
                "apps.deals.calculation_recognition.recognize_policy_from_text",
                return_value=(
                    {"policy": {"vehicle_brand": "Другой бренд"}},
                    "text",
                ),
            ),
        ):
            recognize_file.return_value = type(
                "Payload",
                (),
                {
                    "normalized_type": "sts",
                    "confidence": 0.95,
                    "warnings": [],
                    "data": {"vehicle_brand": "Lada"},
                },
            )()
            response = self.api_client.post(
                f"/api/v1/deals/{self.deal.id}/recognize-calculation/",
                {
                    "calculation_type": "osago",
                    "file_ids": ["sts-file"],
                    "source_text": "Дополнительный текст",
                },
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["data"]["vehicle"]["brand"], "Lada")
        self.assertTrue(
            any("vehicle.brand" in item for item in response.data["warnings"])
        )
        self.assertEqual(response.data["sources"]["files"][0]["id"], "sts-file")
        self.assertTrue(response.data["sources"]["textIncluded"])

    def test_recognize_rejects_empty_sources(self):
        self.authenticate(self.seller)
        response = self.api_client.post(
            f"/api/v1/deals/{self.deal.id}/recognize-calculation/",
            {"calculation_type": "osago"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_other_user_cannot_recognize_calculation(self):
        self.authenticate(self.other_user)
        response = self.api_client.post(
            f"/api/v1/deals/{self.deal.id}/recognize-calculation/",
            {"calculation_type": "osago", "source_text": "текст"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_seller_can_save_and_read_calculation(self):
        self.authenticate(self.seller)
        data = {
            "policyholder": {
                "full_name": "ИВАНОВ ИВАН ИВАНОВИЧ",
                "birth_date": "1980-01-01",
                "passport_series": "1234",
                "passport_number": "567890",
                "registration_address": "Москва",
            },
            "drivers": [],
            "vehicle": {
                "vin": "",
                "brand": "Lada",
                "model": "Vesta",
                "year": 2020,
                "plate_number": "",
                "sts_series": "",
                "sts_number": "",
            },
            "insurance": {
                "start_date": "2026-01-01",
                "region": "Москва",
                "usage_purpose": "Личная",
                "unlimited_drivers": False,
            },
        }
        response = self.api_client.patch(
            f"/api/v1/deals/{self.deal.id}/calculation/",
            {
                "calculation_type": "osago",
                "calculation_data": data,
                "source_text": "текст",
                "source_file_ids": [],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.deal.refresh_from_db()
        self.assertEqual(self.deal.calculation_type, "osago")
        self.assertEqual(self.deal.calculation_data, data)
        self.assertEqual(self.deal.calculation_updated_by, self.seller)

    def test_save_rejects_file_outside_deal_folder(self):
        self.authenticate(self.seller)
        Deal.objects.filter(pk=self.deal.pk).update(drive_folder_id="deal-folder")
        with patch(
            "apps.deals.view_mixins.document_recognition.build_drive_file_tree_map",
            return_value={},
        ):
            response = self.api_client.patch(
                f"/api/v1/deals/{self.deal.id}/calculation/",
                {
                    "calculation_type": "osago",
                    "calculation_data": {},
                    "source_file_ids": ["foreign-file"],
                },
                format="json",
            )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
