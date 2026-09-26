from apps.clients.models import Client
from apps.deals.models import Deal, InsuranceCompany, InsuranceType
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from .models import (
    ClientPassport,
    DealParticipant,
    Mortgage,
    MortgageBalance,
    Platform,
    RequestVersion,
    Vehicle,
)


class InsuranceDataTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username="insurance-owner", password="test"
        )
        self.client_record = Client.objects.create(name="Клиент", created_by=self.user)
        self.deal = Deal.objects.create(
            title="Тест", client=self.client_record, seller=self.user
        )
        self.vehicle = Vehicle.objects.create(deal=self.deal, title="Автомобиль")
        self.company = InsuranceCompany.objects.create(name="Компания")
        self.kind = InsuranceType.objects.create(name="КАСКО")
        self.platform = Platform.objects.create(name="Кабинет")
        self.api = APIClient()
        self.api.force_authenticate(self.user)
        self.prefix = "/api/v1/insurance-data/"

    def payload(self):
        return {
            "deal": str(self.deal.pk),
            "title": "КАСКО",
            "insurance_type": str(self.kind.pk),
            "vehicle": str(self.vehicle.pk),
            "policyholder": str(self.client_record.pk),
            "drivers": [str(self.client_record.pk)],
            "targets": [
                {
                    "insurance_company": str(self.company.pk),
                    "platform": str(self.platform.pk),
                }
            ],
            "deductibles": ["0", "10000"],
            "official_dealer": True,
            "vehicle_value_mode": "maximum",
        }

    def test_matrix_version_close_copy_and_snapshot(self):
        response = self.api.post(
            self.prefix + "requests/", self.payload(), format="json"
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(len(response.data["variants"]), 2)
        request_id = response.data["id"]
        url = self.prefix + f"requests/{request_id}/"
        old = RequestVersion.objects.get(
            insurance_request_id=request_id, number=1
        ).snapshot
        response = self.api.patch(url, {"deductibles": ["0"]}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["version"], 2)
        self.assertEqual(
            RequestVersion.objects.get(
                insurance_request_id=request_id, number=1
            ).snapshot,
            old,
        )
        self.assertEqual(self.api.post(url + "close/").status_code, 200)
        self.assertEqual(
            self.api.patch(url, {"title": "Нельзя"}, format="json").status_code, 400
        )
        self.assertEqual(self.api.post(url + "copy/").status_code, 201)
        self.assertEqual(self.api.post(url + "reopen/").status_code, 200)

    def test_documents_history_restore_and_year(self):
        first = ClientPassport.objects.create(client=self.client_record, number="1")
        second = ClientPassport.objects.create(client=self.client_record, number="2")
        first.refresh_from_db()
        self.assertFalse(first.is_current)
        response = self.api.post(
            self.prefix + "driver-licenses/",
            {
                "client": str(self.client_record.pk),
                "experience_start": "1986",
                "source_links": [
                    {"url": "https://example.com/1.jpg", "label": "Оборот"}
                ],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["experience_start"], "1986-12-31")
        url = self.prefix + f"passports/{second.pk}/"
        self.assertEqual(
            self.api.patch(url, {"number": "3"}, format="json").status_code, 200
        )
        history = self.api.get(url + "history/").data
        self.assertEqual(len(history), 2)
        self.assertEqual(self.api.delete(url).status_code, 204)
        self.assertEqual(self.api.post(url + "restore/").status_code, 200)

    def test_isolation_and_invalid_conditions(self):
        other = Deal.objects.create(
            title="Другой", client=self.client_record, seller=self.user
        )
        vehicle = Vehicle.objects.create(deal=other, title="Другой")
        payload = self.payload()
        payload["vehicle"] = str(vehicle.pk)
        self.assertEqual(
            self.api.post(
                self.prefix + "requests/", payload, format="json"
            ).status_code,
            400,
        )
        payload = self.payload()
        payload["targets"] = []
        self.assertEqual(
            self.api.post(
                self.prefix + "requests/", payload, format="json"
            ).status_code,
            400,
        )
        payload = self.payload()
        payload["deductibles"] = ["-1"]
        self.assertEqual(
            self.api.post(
                self.prefix + "requests/", payload, format="json"
            ).status_code,
            400,
        )
        stranger = get_user_model().objects.create_user(username="stranger")
        self.api.force_authenticate(stranger)
        self.assertEqual(
            self.api.get(self.prefix + f"vehicles/{self.vehicle.pk}/").status_code, 404
        )
        self.assertEqual(
            self.api.post(
                self.prefix + "vehicles/",
                {"deal": str(self.deal.pk), "title": "x"},
                format="json",
            ).status_code,
            403,
        )
        self.assertTrue(
            DealParticipant.objects.filter(
                deal=self.deal, client=self.client_record
            ).exists()
        )

    def test_document_replacement_api_and_vehicle_documents(self):
        for resource, owner in [
            ("passports", {"client": str(self.client_record.pk)}),
            ("driver-licenses", {"client": str(self.client_record.pk)}),
            ("vehicle-registrations", {"vehicle": str(self.vehicle.pk)}),
            ("vehicle-titles", {"vehicle": str(self.vehicle.pk)}),
        ]:
            first = self.api.post(
                self.prefix + resource + "/", {**owner, "number": "1"}, format="json"
            )
            second = self.api.post(
                self.prefix + resource + "/", {**owner, "number": "2"}, format="json"
            )
            self.assertEqual(first.status_code, 201, first.data)
            self.assertEqual(second.status_code, 201, second.data)
            old = self.api.get(self.prefix + resource + f"/{first.data['id']}/")
            self.assertFalse(old.data["is_current"])

    def test_mortgage_snapshot_and_source_change(self):
        from apps.deals.models import Bank

        bank = Bank.objects.create(name="Банк")
        mortgage = Mortgage.objects.create(deal=self.deal, title="Ипотека", bank=bank)
        balance = MortgageBalance.objects.create(
            mortgage=mortgage, amount="100000", as_of_date="2026-09-26"
        )
        kind = InsuranceType.objects.create(name="Жизнь и недвижимость")
        payload = self.payload()
        for field in (
            "vehicle",
            "drivers",
            "deductibles",
            "official_dealer",
            "vehicle_value_mode",
        ):
            payload.pop(field)
        payload.update(
            insurance_type=str(kind.pk),
            mortgage=str(mortgage.pk),
            mortgage_balance=str(balance.pk),
        )
        response = self.api.post(self.prefix + "requests/", payload, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["mortgage_amount"], "100000.00")
        self.assertIn("insured_person", response.data["missing_fields"])
        url = self.prefix + f"requests/{response.data['id']}/"
        self.assertFalse(self.api.get(url + "passport/").data["sources_changed"])
        self.api.post(url + "close/")
        self.assertFalse(self.api.get(url + "passport/").data["sources_changed"])
        mortgage.address = "Новый адрес"
        mortgage.save()
        self.assertTrue(self.api.get(url + "passport/").data["sources_changed"])

    def test_backfill_does_not_restore_removed_participant(self):
        from .signals import backfill_participants

        participant = DealParticipant.objects.get(
            deal=self.deal, client=self.client_record
        )
        participant.delete()
        backfill_participants()
        self.deal.save()
        self.assertFalse(DealParticipant.objects.filter(pk=participant.pk).exists())

    def test_noop_update_does_not_generate_version(self):
        response = self.api.post(
            self.prefix + "requests/", self.payload(), format="json"
        )
        url = self.prefix + f"requests/{response.data['id']}/"
        response = self.api.patch(url, {"title": "КАСКО"}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["version"], 1)
        self.assertEqual(len(response.data["variants"]), 2)

    def test_invalid_links_and_deleted_participant(self):
        response = self.api.post(
            self.prefix + "passports/",
            {
                "client": str(self.client_record.pk),
                "source_links": [{"url": "file:///secret"}],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        person = Client.objects.create(name="Участник")
        response = self.api.post(
            self.prefix + "participants/",
            {"deal": str(self.deal.pk), "client": str(person.pk)},
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        person.delete()
        response = self.api.post(
            self.prefix + "participants/",
            {"deal": str(self.deal.pk), "client": str(person.pk)},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_variant_reason_and_old_version_lock(self):
        response = self.api.post(
            self.prefix + "requests/", self.payload(), format="json"
        )
        variant = response.data["variants"][0]["id"]
        url = self.prefix + f"variants/{variant}/"
        self.assertEqual(
            self.api.patch(url, {"status": "failed"}, format="json").status_code, 400
        )
        self.assertEqual(
            self.api.patch(
                url, {"status": "failed", "explanation": "Нет тарифа"}, format="json"
            ).status_code,
            200,
        )
        self.api.patch(
            self.prefix + f"requests/{response.data['id']}/",
            {"deductibles": ["0"]},
            format="json",
        )
        self.assertEqual(
            self.api.patch(url, {"status": "pending"}, format="json").status_code, 400
        )

    def test_deleted_record_cannot_be_edited_and_duplicate_participant(self):
        payload = {"deal": str(self.deal.pk), "client": str(self.client_record.pk)}
        self.assertEqual(
            self.api.post(
                self.prefix + "participants/", payload, format="json"
            ).status_code,
            400,
        )
        url = self.prefix + f"vehicles/{self.vehicle.pk}/"
        self.assertEqual(self.api.delete(url).status_code, 204)
        self.assertEqual(
            self.api.patch(
                url + "?include_deleted=true", {"title": "x"}, format="json"
            ).status_code,
            404,
        )
        self.assertEqual(self.api.post(url + "restore/").status_code, 200)

    def test_malformed_uuid_filters(self):
        for resource, field in [
            ("vehicles", "deal"),
            ("passports", "client"),
            ("vehicle-titles", "vehicle"),
            ("mortgage-balances", "mortgage"),
            ("variants", "insurance_request"),
        ]:
            response = self.api.get(self.prefix + f"{resource}/?{field}=invalid-id")
            self.assertEqual(response.status_code, 400, response.data)

    def test_mortgage_dates_validate_partial_updates(self):
        payload = {
            "deal": str(self.deal.pk),
            "title": "Ипотека",
            "agreement_date": "2026-01-01",
            "end_date": "2025-01-01",
        }
        response = self.api.post(self.prefix + "mortgages/", payload, format="json")
        self.assertEqual(response.status_code, 400)
        payload["end_date"] = "2030-01-01"
        response = self.api.post(self.prefix + "mortgages/", payload, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        response = self.api.patch(
            self.prefix + f"mortgages/{response.data['id']}/",
            {"end_date": "2025-01-01"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_bootstrap_skips_missing_schema(self):
        from unittest.mock import patch

        from .signals import backfill_participants

        with patch("django.db.connection.introspection.table_names", return_value=[]):
            self.assertEqual(backfill_participants(), 0)
