from unittest.mock import patch

from apps.clients.models import Client
from apps.deals.models import Deal, InsuranceCompany, InsuranceType
from apps.insurance_requests.models import (
    ClientPassport,
    DealParticipant,
    DriverLicense,
    InsuranceRequest,
    Mortgage,
    MortgageBalance,
    Platform,
    RecordHistory,
    RequestVariant,
    RequestVersion,
    Vehicle,
    VehicleRegistration,
    VehicleTitle,
)
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIRequestFactory

from .lifecycle_read_views import (
    LifecycleRecordDetailView,
    LifecycleRecordHistoryView,
    LifecycleRecordListView,
    RequestVersionsView,
)
from .models import CodexReadKey, CodexWriteKey


class LifecycleReadTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username="lifecycle-reader")
        drive = patch("apps.deals.signals.ensure_deal_folder")
        drive.start()
        self.addCleanup(drive.stop)
        with patch("apps.clients.signals.ensure_client_folder"), patch(
            "apps.deals.signals.ensure_deal_folder"
        ):
            self.client_record = Client.objects.create(name="Test person")
            self.other_client = Client.objects.create(name="Other person")
            self.deal = Deal.objects.create(title="Test", client=self.client_record)
            self.other_deal = Deal.objects.create(
                title="Other", client=self.other_client
            )
        self.participant = DealParticipant.objects.get(
            deal=self.deal, client=self.client_record
        )
        self.passport = ClientPassport.objects.create(client=self.client_record)
        self.vehicle = Vehicle.objects.create(deal=self.deal, title="Test vehicle")
        self.kind = InsuranceType.objects.create(name="Test insurance")
        self.application = InsuranceRequest.objects.create(
            deal=self.deal,
            title="Test request",
            vehicle=self.vehicle,
            insurance_type=self.kind,
            version=1,
        )
        self.version = RequestVersion.objects.create(
            insurance_request=self.application, number=1, snapshot={"value": "original"}
        )
        self.key, self.token = CodexReadKey.issue("Lifecycle read tests")
        self.factory = APIRequestFactory()

    def read(self, view, entity=None, record=None, query=None, token=None, deal=None):
        request = self.factory.get(
            "/api/v1/codex/test/",
            data=query or {},
            HTTP_AUTHORIZATION=f"Bearer {token or self.token}",
        )
        kwargs = {"deal_id": (deal or self.deal).pk}
        if entity:
            kwargs["entity"] = entity
        if record:
            kwargs["record_id"] = record.pk
        if view is RequestVersionsView:
            kwargs["request_id"] = self.application.pk
        return view.as_view()(request, **kwargs)

    def test_all_entity_lists_details_and_scoping(self):
        license_record = DriverLicense.objects.create(client=self.client_record)
        registration = VehicleRegistration.objects.create(vehicle=self.vehicle)
        title = VehicleTitle.objects.create(vehicle=self.vehicle)
        mortgage = Mortgage.objects.create(deal=self.deal, title="Mortgage")
        balance = MortgageBalance.objects.create(
            mortgage=mortgage, amount="100", as_of_date="2026-01-01"
        )
        variant = RequestVariant.objects.create(
            insurance_request=self.application,
            request_version=self.version,
            insurance_company=InsuranceCompany.objects.create(name="Company"),
            platform=Platform.objects.create(name="Platform"),
        )
        records = {
            "participant": self.participant,
            "passport": self.passport,
            "driver_license": license_record,
            "vehicle": self.vehicle,
            "vehicle_registration": registration,
            "vehicle_title": title,
            "mortgage": mortgage,
            "mortgage_balance": balance,
            "request": self.application,
            "variant": variant,
        }
        for entity, record in records.items():
            with self.subTest(entity=entity):
                response = self.read(LifecycleRecordListView, entity)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.data["count"], 1)
                self.assertEqual(response.data["results"][0]["id"], str(record.pk))
                detail = self.read(LifecycleRecordDetailView, entity, record)
                self.assertEqual(detail.status_code, 200)
                foreign = self.read(
                    LifecycleRecordDetailView, entity, record, deal=self.other_deal
                )
                self.assertEqual(foreign.status_code, 404)
        self.assertEqual(detail.data["insurance_company_name"], "Company")
        self.assertEqual(detail.data["platform_name"], "Platform")

    def test_pagination_current_and_deleted_filters(self):
        Vehicle.objects.create(deal=self.deal, title="Inactive", is_current=False)
        deleted = Vehicle.objects.create(deal=self.deal, title="Deleted")
        deleted.delete()
        result = self.read(LifecycleRecordListView, "vehicle", query={"page_size": 1})
        self.assertEqual(result.data["count"], 2)
        self.assertEqual(len(result.data["results"]), 1)
        self.assertIn("page=2", result.data["next"])
        inactive = self.read(
            LifecycleRecordListView, "vehicle", query={"current": "false"}
        )
        self.assertEqual(inactive.data["count"], 1)
        dead = self.read(LifecycleRecordListView, "vehicle", query={"deleted": "only"})
        self.assertEqual(dead.data["results"][0]["id"], str(deleted.pk))
        self.assertEqual(
            self.read(LifecycleRecordDetailView, "vehicle", deleted).status_code, 404
        )
        self.assertEqual(
            self.read(
                LifecycleRecordDetailView, "vehicle", deleted, {"deleted": "include"}
            ).status_code,
            200,
        )
        for query in ({"deleted": "yes"}, {"current": "yes"}, {"page": "bad"}):
            self.assertEqual(
                self.read(LifecycleRecordListView, "vehicle", query=query).status_code,
                400,
            )

    def test_parent_deletion_and_historical_participation(self):
        registration = VehicleRegistration.objects.create(vehicle=self.vehicle)
        mortgage = Mortgage.objects.create(deal=self.deal, title="Parent")
        balance = MortgageBalance.objects.create(
            mortgage=mortgage, amount="100", as_of_date="2026-01-01"
        )
        variant = RequestVariant.objects.create(
            insurance_request=self.application,
            request_version=self.version,
            insurance_company=InsuranceCompany.objects.create(name="Company"),
            platform=Platform.objects.create(name="Platform"),
        )
        self.vehicle.delete()
        self.participant.delete()
        mortgage.delete()
        self.application.delete()
        for entity, record in (
            ("passport", self.passport),
            ("vehicle_registration", registration),
            ("mortgage_balance", balance),
            ("variant", variant),
        ):
            self.assertEqual(
                self.read(LifecycleRecordListView, entity).data["count"], 0
            )
            self.assertEqual(
                self.read(LifecycleRecordDetailView, entity, record).status_code, 404
            )
            self.assertEqual(
                self.read(
                    LifecycleRecordDetailView, entity, record, {"deleted": "include"}
                ).status_code,
                200,
            )
        ClientPassport.objects.create(client=self.other_client)
        result = self.read(
            LifecycleRecordListView, "passport", query={"deleted": "include"}
        )
        self.assertEqual(result.data["count"], 1)

    def test_history_and_versions_are_scoped_and_preserved(self):
        RecordHistory.objects.create(
            model_name=self.passport._meta.label_lower,
            record_id=self.passport.pk,
            action="codex_prepare",
            snapshot={"client": str(self.client_record.pk)},
        )
        response = self.read(LifecycleRecordHistoryView, "passport", self.passport)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(
            self.read(
                LifecycleRecordHistoryView,
                "passport",
                self.passport,
                deal=self.other_deal,
            ).status_code,
            404,
        )
        RequestVersion.objects.create(
            insurance_request=self.application, number=2, snapshot={"value": "new"}
        )
        self.application.delete()
        self.assertEqual(self.read(RequestVersionsView).status_code, 404)
        response = self.read(RequestVersionsView, query={"deleted": "include"})
        self.assertEqual(response.data["count"], 2)
        self.assertEqual(response.data["results"][1]["snapshot"], {"value": "original"})
        self.assertEqual(
            self.read(
                RequestVersionsView,
                query={"deleted": "include"},
                deal=self.other_deal,
            ).status_code,
            404,
        )

    def test_authentication_closed_deleted_deal_and_bounded_output(self):
        _, writer = CodexWriteKey.issue("Not a reader")
        for token in ("invalid", writer):
            self.assertEqual(
                self.read(LifecycleRecordListView, "vehicle", token=token).status_code,
                403,
            )
        with patch("apps.codex_reader.request_views.MAX_PASSPORT_BYTES", 10):
            self.assertEqual(
                self.read(LifecycleRecordListView, "vehicle").status_code, 413
            )
        self.key.revoke()
        self.assertEqual(self.read(LifecycleRecordListView, "vehicle").status_code, 403)
        self.key, self.token = CodexReadKey.issue("Another reader")
        self.deal.status = "won"
        self.deal.save(update_fields=["status"])
        self.assertEqual(self.read(LifecycleRecordListView, "vehicle").status_code, 200)
        self.deal.delete()
        self.assertEqual(
            self.read(
                LifecycleRecordListView, "vehicle", query={"deleted": "include"}
            ).status_code,
            404,
        )
