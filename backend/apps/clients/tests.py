from unittest.mock import patch

from apps.clients.models import Client
from apps.clients.serializers import ClientSerializer
from apps.clients.services import ClientMergeService
from apps.clients.views import ClientViewSet
from apps.common.drive import DriveError
from apps.common.tests.auth_utils import AuthenticatedAPITestCase
from apps.deals.models import Deal
from apps.policies.models import Policy
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate


class ClientOwnershipTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.user = User.objects.create_user(username="owner")
        self.other_user = User.objects.create_user(username="other")

    def test_owner_query_includes_created_clients(self):
        client_owned = Client.objects.create(name="Owned", created_by=self.user)
        client_for_deal = Client.objects.create(name="Deal client")
        Deal.objects.create(title="Deal", client=client_for_deal, seller=self.user)
        client_other = Client.objects.create(
            name="Other client", created_by=self.other_user
        )

        request = self.factory.get("/clients/")
        force_authenticate(request, user=self.user)
        viewset = ClientViewSet()
        viewset.request = request
        queryset = viewset.get_queryset()

        self.assertIn(client_owned, queryset)
        self.assertIn(client_for_deal, queryset)
        self.assertNotIn(client_other, queryset)

    def test_perform_create_sets_created_by(self):
        request = self.factory.post("/clients/", {"name": "New"})
        force_authenticate(request, user=self.user)
        serializer = ClientSerializer(data={"name": "New client"})
        serializer.is_valid(raise_exception=True)

        viewset = ClientViewSet()
        viewset.request = request
        viewset.perform_create(serializer)

        self.assertEqual(serializer.instance.created_by, self.user)

    def test_serializer_allows_null_email(self):
        serializer = ClientSerializer(data={"name": "No email", "email": None})
        self.assertTrue(serializer.is_valid())
        client = serializer.save(created_by=self.user)
        self.assertIsNone(client.email)

    def test_owner_can_modify(self):
        client = Client.objects.create(name="Owned", created_by=self.user)
        viewset = ClientViewSet()

        self.assertTrue(viewset._can_modify(self.user, client))
        self.assertFalse(viewset._can_modify(self.other_user, client))


class ClientMergeServiceTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username="owner")
        self.target = Client.objects.create(
            name="Иванов Иван Иванович",
            phone="+79990000000",
            email="target@example.com",
            created_by=self.owner,
        )
        self.source = Client.objects.create(
            name="иванов иван",
            phone="+7 (999) 111-22-33",
            email="source@example.com",
            created_by=self.owner,
        )
        self.source_deal = Deal.objects.create(
            title="Source deal",
            client=self.source,
            seller=self.owner,
            status="open",
            stage_name="initial",
        )
        self.source_policy = Policy.objects.create(
            number="PL-001",
            deal=self.source_deal,
            client=self.source,
            insured_client=self.source,
        )

    def test_merge_moves_soft_deleted_records_when_include_deleted_true(self):
        self.source_deal.delete()
        self.source_policy.delete()
        service = ClientMergeService(
            target_client=self.target,
            source_clients=[self.source],
            include_deleted=True,
            field_overrides={"name": "Иванов Иван Иванович"},
        )
        result = service.merge()

        moved_deal = Deal.objects.with_deleted().get(pk=self.source_deal.pk)
        moved_policy = Policy.objects.with_deleted().get(pk=self.source_policy.pk)
        self.assertEqual(moved_deal.client_id, self.target.id)
        self.assertEqual(moved_policy.client_id, self.target.id)
        self.assertEqual(moved_policy.insured_client_id, self.target.id)
        self.assertEqual(result["moved_counts"]["deals"], 1)
        self.assertEqual(result["moved_counts"]["policies"], 1)

    def test_merge_aborts_on_drive_error_before_db_changes(self):
        original_name = self.target.name
        with patch(
            "apps.clients.services.ensure_client_folder",
            side_effect=DriveError("Drive unavailable"),
        ):
            with self.assertRaises(DriveError):
                ClientMergeService(
                    target_client=self.target,
                    source_clients=[self.source],
                    include_deleted=True,
                    field_overrides={"name": "Новое имя"},
                ).merge()

        self.target.refresh_from_db()
        self.source_deal.refresh_from_db()
        self.assertEqual(self.target.name, original_name)
        self.assertEqual(self.source_deal.client_id, self.source.id)


class ClientMergeAPITests(AuthenticatedAPITestCase):
    def setUp(self):
        super().setUp()
        self.owner = User.objects.create_user(username="owner", password="pass")
        self.other = User.objects.create_user(username="other", password="pass")
        self.target = Client.objects.create(name="Иванов Иван", created_by=self.owner)
        self.source = Client.objects.create(name="иванов ИВАН", created_by=self.owner)
        self.source_deal = Deal.objects.create(
            title="Source deal",
            client=self.source,
            seller=self.owner,
            status="open",
            stage_name="initial",
        )
        self.source_policy = Policy.objects.create(
            number="PL-API-001",
            deal=self.source_deal,
            client=self.source,
            insured_client=self.source,
        )
        self.authenticate(self.owner)

    def test_merge_preview_returns_counts_and_warnings(self):
        response = self.api_client.post(
            "/api/v1/clients/merge/preview/",
            {
                "target_client_id": str(self.target.id),
                "source_client_ids": [str(self.source.id)],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["moved_counts"]["deals"], 1)
        self.assertEqual(response.data["moved_counts"]["policies_unique"], 1)
        self.assertTrue(response.data["warnings"])

    def test_merge_applies_field_overrides(self):
        response = self.api_client.post(
            "/api/v1/clients/merge/",
            {
                "target_client_id": str(self.target.id),
                "source_client_ids": [str(self.source.id)],
                "field_overrides": {
                    "name": "Иванов Иван Иванович",
                    "phone": "+79990001122",
                    "email": "merged@example.com",
                    "notes": "merged-note",
                },
                "preview_snapshot_id": "snap-1",
                "include_deleted": True,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.target.refresh_from_db()
        self.assertEqual(self.target.name, "Иванов Иван Иванович")
        self.assertEqual(self.target.phone, "+79990001122")
        self.assertEqual(self.target.email, "merged@example.com")
        self.assertEqual(self.target.notes, "merged-note")

    def test_merge_preview_requires_permissions(self):
        self.authenticate(self.other)
        response = self.api_client.post(
            "/api/v1/clients/merge/preview/",
            {
                "target_client_id": str(self.target.id),
                "source_client_ids": [str(self.source.id)],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 403)
