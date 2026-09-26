from unittest.mock import patch

from apps.clients.models import Client
from apps.clients.services import ClientMergeService, ClientMergeSessionService
from apps.common.tests.auth_utils import AuthenticatedAPITestCase
from apps.deals.models import Deal, InsuranceType
from apps.insurance_requests.models import (
    ClientPassport,
    DealParticipant,
    DriverLicense,
    InsuranceRequest,
    RequestVersion,
    Vehicle,
)
from apps.policies.models import Policy
from django.contrib.auth.models import User
from django.test import TestCase


class InsuranceClientMergeTests(TestCase):
    def setUp(self):
        self.drive = patch("apps.clients.signals.ensure_client_folder")
        self.drive.start()
        self.addCleanup(self.drive.stop)
        self.target = Client.objects.create(name="Целевой")
        self.source = Client.objects.create(name="Исходный")
        self.other = Client.objects.create(name="Другой страхователь")
        self.deal = Deal.objects.create(title="Общая сделка", client=self.source)

    def service(self, overrides=None):
        return ClientMergeService(
            target_client=self.target,
            source_clients=[self.source],
            field_overrides=overrides,
        )

    def test_preserves_unrelated_policy_and_moves_direct_policy(self):
        unrelated = Policy.objects.create(
            number="other", deal=self.deal, client=self.other
        )
        another_deal = Deal.objects.create(title="Other", client=self.other)
        direct = Policy.objects.create(
            number="direct", deal=another_deal, client=self.source
        )
        self.service().merge(sync_drive=False)
        unrelated.refresh_from_db()
        direct.refresh_from_db()
        self.assertEqual(unrelated.client_id, self.other.pk)
        self.assertEqual(direct.client_id, self.target.pk)

    def test_requires_explicit_current_document_choice_and_transfers_history(self):
        first = ClientPassport.objects.create(client=self.target, number="1")
        second = ClientPassport.objects.create(client=self.source, number="2")
        license = DriverLicense.objects.create(client=self.source, number="3")
        preview = self.service().build_preview()
        self.assertEqual(preview["document_conflicts"][0]["kind"], "passport")
        with self.assertRaises(ValueError):
            self.service().merge(sync_drive=False)
        with self.assertRaises(ValueError):
            ClientMergeSessionService.start(
                target_client=self.target,
                source_clients=[self.source],
                actor=None,
                include_deleted=True,
                field_overrides={},
            )
        self.service({"current_passport_id": str(second.pk)}).merge(sync_drive=False)
        first.refresh_from_db()
        second.refresh_from_db()
        license.refresh_from_db()
        self.assertFalse(first.is_current)
        self.assertTrue(second.is_current)
        self.assertEqual(second.client_id, self.target.pk)
        self.assertEqual(license.client_id, self.target.pk)

    def test_roles_memberships_and_historical_snapshot(self):
        DealParticipant.objects.create(deal=self.deal, client=self.target)
        DealParticipant.objects.get_or_create(deal=self.deal, client=self.source)
        vehicle = Vehicle.objects.create(deal=self.deal, title="Автомобиль")
        kind = InsuranceType.objects.create(name="КАСКО")
        request = InsuranceRequest.objects.create(
            deal=self.deal,
            title="Заявка",
            vehicle=vehicle,
            insurance_type=kind,
            policyholder=self.source,
            owner=self.source,
        )
        request.drivers.add(self.source, self.target)
        snapshot = {"policyholder": str(self.source.pk)}
        version = RequestVersion.objects.create(
            insurance_request=request, number=1, snapshot=snapshot
        )
        self.service().merge(sync_drive=False)
        request.refresh_from_db()
        version.refresh_from_db()
        self.assertEqual(request.policyholder_id, self.target.pk)
        self.assertEqual(request.owner_id, self.target.pk)
        self.assertEqual(
            list(request.drivers.values_list("pk", flat=True)), [self.target.pk]
        )
        self.assertEqual(DealParticipant.objects.filter(deal=self.deal).count(), 1)
        self.assertEqual(version.snapshot, snapshot)

    def test_rejects_foreign_document_choice(self):
        foreign = ClientPassport.objects.create(client=self.other)
        with self.assertRaises(ValueError):
            self.service({"current_passport_id": str(foreign.pk)}).merge(
                sync_drive=False
            )


class ClientAvailabilityAPITests(AuthenticatedAPITestCase):
    def setUp(self):
        super().setUp()
        patcher = patch("apps.clients.signals.ensure_client_folder")
        patcher.start()
        self.addCleanup(patcher.stop)
        self.owner = User.objects.create_user(username="data-owner")
        self.other = User.objects.create_user(username="data-other")
        self.authenticate(self.owner)
        self.current = Client.objects.create(name="Текущий", created_by=self.owner)
        self.second = Client.objects.create(name="Другой", created_by=self.owner)

    def test_lookup_returns_all_living_clients_without_current_flag(self):
        deleted = Client.objects.create(name="Удалённый", created_by=self.owner)
        deleted.delete()
        lookup = self.client.get("/api/v1/clients/lookup/")
        self.assertEqual(lookup.status_code, 200)
        self.assertCountEqual(
            [item["id"] for item in lookup.data["results"]],
            [str(self.current.pk), str(self.second.pk)],
        )
        response = self.client.get(f"/api/v1/clients/{self.current.pk}/")
        self.assertNotIn("is_current", response.data)
        response = self.client.patch(
            f"/api/v1/clients/{self.current.pk}/", {"name": "Новое имя"}
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertIsNone(response.data["birth_date"])

    def test_restore_requires_owner_and_deleted_client_cannot_be_patched(self):
        self.current.delete()
        url = f"/api/v1/clients/{self.current.pk}/"
        self.assertEqual(
            self.client.patch(
                url + "?show_deleted=true", {"name": "Changed"}
            ).status_code,
            404,
        )
        self.authenticate(self.other)
        self.assertEqual(self.client.post(url + "restore/").status_code, 403)
        self.authenticate(self.owner)
        self.assertEqual(self.client.post(url + "restore/").status_code, 200)
        self.current.refresh_from_db()
        self.assertIsNone(self.current.deleted_at)
