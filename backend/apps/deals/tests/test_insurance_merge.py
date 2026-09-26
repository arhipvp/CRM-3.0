from unittest.mock import patch

from apps.clients.models import Client
from apps.deals.models import Deal, InsuranceType
from apps.deals.services import DealMergeService
from apps.insurance_requests.models import (
    DealParticipant,
    InsuranceRequest,
    Mortgage,
    RequestVersion,
    Vehicle,
)
from django.test import TestCase


class DealInsuranceMergeTests(TestCase):
    def setUp(self):
        for name in (
            "apps.clients.signals.ensure_client_folder",
            "apps.deals.signals.ensure_deal_folder",
            "apps.deals.services.DealMergeService._prepare_drive_folders",
        ):
            patcher = patch(name)
            patcher.start()
            self.addCleanup(patcher.stop)
        self.person = Client.objects.create(name="Участник")
        self.target = Deal.objects.create(title="Первый", client=self.person)
        self.source = Deal.objects.create(title="Второй", client=self.person)

    def test_moves_objects_requests_and_deduplicates_participants_without_snapshot_changes(
        self,
    ):
        vehicle = Vehicle.objects.create(deal=self.source, title="Машина")
        mortgage = Mortgage.objects.create(deal=self.target, title="Ипотека")
        application = InsuranceRequest.objects.create(
            deal=self.source,
            title="КАСКО",
            insurance_type=InsuranceType.objects.create(name="КАСКО"),
            vehicle=vehicle,
            owner=self.person,
        )
        snapshot = {"deal": str(self.source.pk), "owner": str(self.person.pk)}
        version = RequestVersion.objects.create(
            insurance_request=application, number=1, snapshot=snapshot
        )
        other = Client.objects.create(name="Неактуальный")
        inactive = DealParticipant.objects.create(
            deal=self.source, client=other, is_current=False
        )
        removed = Client.objects.create(name="Удалённый участник")
        deleted = DealParticipant.objects.create(deal=self.source, client=removed)
        deleted.delete()
        result = DealMergeService(
            target_deal=self.target, source_deals=[self.source]
        ).merge()["result_deal"]
        for obj in (vehicle, mortgage, application, inactive, deleted):
            obj.refresh_from_db()
            self.assertEqual(obj.deal_id, result.pk)
        self.assertFalse(inactive.is_current)
        self.assertIsNotNone(deleted.deleted_at)
        self.assertEqual(
            DealParticipant.objects.filter(deal=result, client=self.person).count(), 1
        )
        version.refresh_from_db()
        self.assertEqual(version.snapshot, snapshot)

    def test_removed_main_client_is_not_reactivated_by_merge(self):
        DealParticipant.objects.filter(deal__in=[self.target, self.source]).delete()
        result = DealMergeService(
            target_deal=self.target, source_deals=[self.source]
        ).merge()["result_deal"]
        self.assertFalse(
            DealParticipant.objects.filter(deal=result, client=self.person).exists()
        )

    def test_rejects_partial_graph_merge_before_drive(self):
        with patch(
            "apps.deals.services.DealMergeService._prepare_drive_folders"
        ) as drive:
            with self.assertRaisesMessage(
                ValueError, "включите перенос удалённых записей"
            ):
                DealMergeService(
                    target_deal=self.target,
                    source_deals=[self.source],
                    include_deleted=False,
                ).merge()
            drive.assert_not_called()
        self.source.refresh_from_db()
        self.assertIsNone(self.source.deleted_at)
